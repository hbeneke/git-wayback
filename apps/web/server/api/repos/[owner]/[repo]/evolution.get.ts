import { eq } from 'drizzle-orm'
import { createDb, evolutionSnapshots, type EvolutionSnapshotData } from '@git-wayback/db'
import {
  EVOLUTION_CACHE_DURATION_MS,
  EVOLUTION,
  GITHUB_API,
  type EvolutionSource,
  type EvolutionSampling,
} from '@git-wayback/shared'

interface GitHubTag {
  name: string
  commit: {
    sha: string
  }
}

interface GitHubRef {
  ref: string
  object: {
    sha: string
    type: 'commit' | 'tag'
  }
}

interface GitHubAnnotatedTag {
  tag: string
  message: string
  object: {
    sha: string
    type: string
  }
}

interface GitHubCommitDetail {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
}

interface GitHubCommitListItem {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
}

interface GitHubTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

interface GitHubTreeResponse {
  sha: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

/**
 * One unit to materialize into a snapshot: a ref label, its commit sha, and an
 * optional pre-resolved message (annotated tag message). The tree + commit
 * date are fetched per item.
 */
interface SnapshotSeed {
  label: string
  sha: string
  message: string | null
  /** Known up-front for commits; null for tags (resolved when materializing) */
  date: string | null
}

/**
 * Pick `count` items from a chronologically-sorted (oldest first) array.
 * - latest: the most recent `count`
 * - spread: evenly spaced, always keeping the first and last
 */
function sampleSnapshots<T>(items: T[], count: number, strategy: EvolutionSampling): T[] {
  if (items.length <= count) return items
  if (count <= 1) return [items[items.length - 1]]
  if (strategy === 'latest') return items.slice(items.length - count)

  // spread: evenly spaced indices across [0, len - 1], endpoints included
  const last = items.length - 1
  const picked: T[] = []
  const seen = new Set<number>()
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * last) / (count - 1))
    if (!seen.has(idx)) {
      seen.add(idx)
      picked.push(items[idx])
    }
  }
  return picked
}

// Resolve the seeds (label + sha) for the tags source
async function fetchTagSeeds(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<SnapshotSeed[]> {
  const tags = await $fetch<GitHubTag[]>(
    `https://api.github.com/repos/${owner}/${repo}/tags`,
    { headers, query: { per_page: EVOLUTION.FETCH_POOL } }
  )

  // GitHub returns tags newest-first; reverse to approximate oldest-first
  return tags
    .map((tag) => ({ label: tag.name, sha: tag.commit.sha, message: null, date: null }))
    .reverse()
}

// Resolve the seeds (label + sha) for the commits source on a given branch
async function fetchCommitSeeds(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<SnapshotSeed[]> {
  const commits = await $fetch<GitHubCommitListItem[]>(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
    { headers, query: { sha: branch, per_page: EVOLUTION.FETCH_POOL } }
  )

  // GitHub returns commits newest-first; reverse to oldest-first.
  // date + message already present here — no per-commit fetch needed.
  return commits
    .map((c) => ({
      label: c.sha.substring(0, 7),
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author.date,
    }))
    .reverse()
}

// Fetch evolution data from GitHub for the given source/branch.
// Seeds are sampled BEFORE materializing trees, so a 50k-file monorepo only
// pulls `limit` recursive trees (≤ MAX_LIMIT), never the whole pool.
async function fetchFromGitHub(
  owner: string,
  repo: string,
  source: EvolutionSource,
  branch: string,
  limit: number,
  sampling: EvolutionSampling
): Promise<EvolutionSnapshotData[]> {
  const headers = getGitHubHeaders()

  // 1. Resolve the cheap seed pool (one list call, no trees)
  const pool =
    source === 'commits'
      ? await fetchCommitSeeds(owner, repo, branch, headers)
      : await fetchTagSeeds(owner, repo, headers)

  if (pool.length === 0) {
    return []
  }

  // 2. Sample down to `limit` BEFORE any tree fetch
  const seeds = sampleSnapshots(pool, limit, sampling)

  // 3. Materialize only the sampled seeds (tree + date when missing)
  const snapshots: EvolutionSnapshotData[] = []

  for (let i = 0; i < seeds.length; i += GITHUB_API.BATCH_SIZE) {
    const batch = seeds.slice(i, i + GITHUB_API.BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (seed) => {
        try {
          const [treeResponse, resolvedDate, annotatedMessage] = await Promise.all([
            $fetch<GitHubTreeResponse>(
              `https://api.github.com/repos/${owner}/${repo}/git/trees/${seed.sha}`,
              { headers, query: { recursive: '1' } }
            ),
            // Commits already carry their date; tags need a commit lookup
            seed.date
              ? Promise.resolve(seed.date)
              : $fetch<GitHubCommitDetail>(
                  `https://api.github.com/repos/${owner}/${repo}/commits/${seed.sha}`,
                  { headers }
                ).then((c) => c.commit.author.date),
            // Only tags can be annotated; skip the extra call for commits
            source === 'tags'
              ? $fetch<GitHubRef>(
                  `https://api.github.com/repos/${owner}/${repo}/git/ref/tags/${seed.label}`,
                  { headers }
                )
                  .then(async (ref) => {
                    if (ref.object.type === 'tag') {
                      const annotated = await $fetch<GitHubAnnotatedTag>(
                        `https://api.github.com/repos/${owner}/${repo}/git/tags/${ref.object.sha}`,
                        { headers }
                      )
                      return annotated.message?.trim() || null
                    }
                    return null
                  })
                  .catch(() => null)
              : Promise.resolve(null),
          ])

          const message = annotatedMessage || seed.message || seed.label

          const files = treeResponse.tree
            .filter((item) => item.type === 'blob')
            .map((item) => {
              const parts = item.path.split('/')
              const name = parts[parts.length - 1]
              const extMatch = name.match(/\.([^.]+)$/)

              return {
                path: item.path,
                name,
                size: item.size || 0,
                extension: extMatch ? extMatch[1] : null,
              }
            })

          return {
            tag: seed.label,
            sha: seed.sha,
            date: resolvedDate,
            message,
            files,
            stats: {
              totalFiles: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0),
            },
          }
        } catch (err) {
          logger.evolution.warn(`Failed to fetch data for ${source} ${seed.label}`, err)
          return null
        }
      })
    )

    for (const result of batchResults) {
      if (result) snapshots.push(result)
    }
  }

  // Sort by date (oldest first)
  snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return snapshots
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = validateRepoParams(event)
  const query = getQuery(event)

  const source: EvolutionSource = EVOLUTION.SOURCES.includes(
    query.source as EvolutionSource
  )
    ? (query.source as EvolutionSource)
    : EVOLUTION.DEFAULT_SOURCE

  const sampling: EvolutionSampling = EVOLUTION.SAMPLING.includes(
    query.sampling as EvolutionSampling
  )
    ? (query.sampling as EvolutionSampling)
    : EVOLUTION.DEFAULT_SAMPLING

  const limit = Math.min(
    Math.max(Number(query.limit) || EVOLUTION.DEFAULT_LIMIT, 1),
    EVOLUTION.MAX_LIMIT
  )

  const db = createDb(getDatabaseUrl())
  const headers = getGitHubHeaders()

  // Branch only matters for the commits source; default to the repo's default
  let branch = typeof query.branch === 'string' ? query.branch : ''
  if (source === 'commits' && !branch) {
    try {
      const repoInfo = await $fetch<{ default_branch: string }>(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers }
      )
      branch = repoInfo.default_branch
    } catch {
      branch = 'main'
    }
  }

  // Cache key scoped by every input that changes the result set. Sampling is
  // applied before tree fetch now, so the cached set IS the final set.
  const branchKey = source === 'commits' ? branch : '-'
  const cacheKey = `${owner}/${repo}#${source}#${branchKey}#${sampling}#${limit}`

  // 1. Serve from cache when fresh. Cache is best-effort: if the DB is
  // unreachable, log and fall through to GitHub instead of 500-ing.
  try {
    const cached = await db
      .select()
      .from(evolutionSnapshots)
      .where(eq(evolutionSnapshots.id, cacheKey))
      .limit(1)

    if (cached.length > 0) {
      const cacheAge = Date.now() - new Date(cached[0].capturedAt).getTime()

      if (cacheAge < EVOLUTION_CACHE_DURATION_MS) {
        logger.evolution.debug(`Cache hit for ${cacheKey}`, {
          ageMinutes: Math.round(cacheAge / 1000 / 60),
        })
        const snaps = cached[0].snapshots as EvolutionSnapshotData[]
        return {
          snapshots: snaps,
          repoName: repo,
          source,
          branch: source === 'commits' ? branch : null,
          sampling,
          poolSize: snaps.length,
          cached: true,
          capturedAt: cached[0].capturedAt,
        }
      }

      logger.evolution.info(`Cache expired for ${cacheKey}, refreshing...`)
    }
  } catch (err) {
    logger.evolution.warn(`Cache read failed for ${cacheKey}, fetching live`, err)
  }

  // 2. Fetch from GitHub (sampling applied before tree materialization)
  logger.evolution.info(`Fetching from GitHub: ${cacheKey}`)
  const pool = await fetchFromGitHub(owner, repo, source, branch, limit, sampling)

  // 3. Cache the result (best-effort — a DB outage must not fail the request)
  if (pool.length > 0) {
    const now = new Date()

    try {
      await db
        .insert(evolutionSnapshots)
        .values({
          id: cacheKey,
          owner,
          name: repo,
          snapshots: pool,
          tagCount: pool.length,
          capturedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: evolutionSnapshots.id,
          set: {
            snapshots: pool,
            tagCount: pool.length,
            capturedAt: now,
            updatedAt: now,
          },
        })

      logger.evolution.success(`Saved ${pool.length} ${source} snapshots for ${cacheKey}`)
    } catch (err) {
      logger.evolution.warn(`Cache write failed for ${cacheKey} (serving live)`, err)
    }
  }

  return {
    snapshots: pool,
    repoName: repo,
    source,
    branch: source === 'commits' ? branch : null,
    sampling,
    poolSize: pool.length,
    cached: false,
    capturedAt: new Date(),
  }
})
