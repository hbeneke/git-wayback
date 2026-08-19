import { createDb, type EvolutionSnapshotData, evolutionSnapshots } from '@git-wayback/db'
import {
  EVOLUTION,
  EVOLUTION_CACHE_DURATION_MS,
  EVOLUTION_MAX_CACHE_BYTES,
  EVOLUTION_REVALIDATE_FLOOR_MS,
  type EvolutionSampling,
  type EvolutionSource,
  FORCE_REFRESH_MIN_AGE_MS,
  GITHUB_API,
} from '@git-wayback/shared'
import { eq } from 'drizzle-orm'

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

// Resolve the seeds (label + sha) for the tags source
async function fetchTagSeeds(owner: string, repo: string): Promise<SnapshotSeed[]> {
  const tags = await github.listTags(owner, repo, EVOLUTION.FETCH_POOL)

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
): Promise<SnapshotSeed[]> {
  const commits = await github.listCommits(owner, repo, {
    sha: branch,
    perPage: EVOLUTION.FETCH_POOL,
  })

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
  sampling: EvolutionSampling,
): Promise<EvolutionSnapshotData[]> {
  // 1. Resolve the cheap seed pool (one list call, no trees)
  const pool =
    source === 'commits'
      ? await fetchCommitSeeds(owner, repo, branch)
      : await fetchTagSeeds(owner, repo)

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
            github.getTree(owner, repo, seed.sha),
            // Commits already carry their date; tags need a commit lookup
            seed.date
              ? Promise.resolve(seed.date)
              : github.getCommit(owner, repo, seed.sha).then((c) => c.commit.author.date),
            // Only tags can be annotated; skip the extra call for commits
            source === 'tags'
              ? github
                  .getTagRef(owner, repo, seed.label)
                  .then(async (ref) => {
                    if (ref.object.type === 'tag') {
                      const annotated = await github.getAnnotatedTag(owner, repo, ref.object.sha)
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
            // Propagate GitHub's truncation flag so the UI can warn instead of
            // silently serving an incomplete file list. We still cache these
            // (otherwise huge repos would never cache); the UI shows the badge.
            truncated: treeResponse.truncated,
          }
        } catch (err) {
          logger.evolution.warn(`Failed to fetch data for ${source} ${seed.label}`, err)
          return null
        }
      }),
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
  const forceRefresh = isForcedRefresh(event)

  // Never let a CDN keep a forced-refresh response: the whole point is that it
  // is computed fresh, and a cached copy would hand out free bypasses.
  if (forceRefresh) setHeader(event, 'Cache-Control', 'no-store')

  const source: EvolutionSource = EVOLUTION.SOURCES.includes(query.source as EvolutionSource)
    ? (query.source as EvolutionSource)
    : EVOLUTION.DEFAULT_SOURCE

  const sampling: EvolutionSampling = EVOLUTION.SAMPLING.includes(
    query.sampling as EvolutionSampling,
  )
    ? (query.sampling as EvolutionSampling)
    : EVOLUTION.DEFAULT_SAMPLING

  // Snapped to the offered options rather than clamped to a range: `limit` is
  // part of the cache key, so accepting every value in 1..MAX_LIMIT meant 30
  // distinct rows per repo/source/branch/sampling combination.
  const requestedLimit = Number(query.limit)
  const limit = (EVOLUTION.LIMIT_OPTIONS as readonly number[]).includes(requestedLimit)
    ? requestedLimit
    : EVOLUTION.DEFAULT_LIMIT

  const db = createDb(getDatabaseUrl())

  // Branch only matters for the commits source; default to the repo's default.
  // Validate BEFORE it reaches the cache key or a GitHub URL — unvalidated
  // free text here lets callers inflate evolution_snapshots rows arbitrarily.
  let branch = typeof query.branch === 'string' ? query.branch.trim() : ''
  if (branch && !isValidGitRef(branch)) {
    throw createError({
      statusCode: 400,
      message: `Invalid branch ref: "${branch}".`,
    })
  }
  // At most one getRepo per request: the default-branch lookup and the
  // pushed_at revalidation below both want it.
  let repoInfo: ReturnType<typeof github.getRepo> | null = null
  const loadRepoInfo = () => {
    repoInfo ??= github.getRepo(owner, repo)
    return repoInfo
  }

  if (source === 'commits' && !branch) {
    try {
      branch = (await loadRepoInfo()).default_branch
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
      const row = cached[0]
      const cacheAge = Date.now() - new Date(row.capturedAt).getTime()

      const serveCached = () => {
        logger.evolution.debug(`Cache hit for ${cacheKey}`, {
          ageMinutes: Math.round(cacheAge / 1000 / 60),
        })
        const snaps = row.snapshots as EvolutionSnapshotData[]
        return {
          snapshots: snaps,
          repoName: repo,
          source,
          branch: source === 'commits' ? branch : null,
          sampling,
          poolSize: snaps.length,
          cached: true,
          capturedAt: row.capturedAt,
        }
      }

      // A forced refresh is honoured only once the row has had a moment to
      // settle, so a double-click cannot turn into two full re-fetches.
      const forcing = forceRefresh && cacheAge >= FORCE_REFRESH_MIN_AGE_MS

      if (forcing) {
        logger.evolution.info(`Forced refresh for ${cacheKey}`)
      } else if (cacheAge < EVOLUTION_REVALIDATE_FLOOR_MS) {
        return serveCached()
      } else {
        // Revalidate against the repo's pushed_at instead of a clock: no push
        // since capture means the snapshots are still exactly right, and the
        // check costs one cheap call rather than a full re-fetch.
        // null = could not tell (row predates the column, or GitHub failed).
        let unchanged: boolean | null = null

        if (row.pushedAt) {
          try {
            const info = await loadRepoInfo()
            unchanged =
              new Date(info.pushed_at).getTime() === new Date(row.pushedAt).getTime()
          } catch (err) {
            logger.evolution.warn(`pushed_at check failed for ${cacheKey}`, err)
          }
        }

        if (unchanged === true) {
          // Bump capturedAt so the following requests fall under the floor and
          // skip even this call. Best-effort: a failed write only costs a check.
          try {
            await db
              .update(evolutionSnapshots)
              .set({ capturedAt: new Date() })
              .where(eq(evolutionSnapshots.id, cacheKey))
          } catch (err) {
            logger.evolution.warn(`capturedAt bump failed for ${cacheKey}`, err)
          }

          return serveCached()
        }

        // Nothing to compare against: fall back to the plain TTL.
        if (unchanged === null && cacheAge < EVOLUTION_CACHE_DURATION_MS) {
          return serveCached()
        }

        logger.evolution.info(`Cache stale for ${cacheKey}, refreshing...`)
      }
    }
  } catch (err) {
    logger.evolution.warn(`Cache read failed for ${cacheKey}, fetching live`, err)
  }

  // 2. Fetch from GitHub (sampling applied before tree materialization)
  logger.evolution.info(`Fetching from GitHub: ${cacheKey}`)
  const pool = await fetchFromGitHub(owner, repo, source, branch, limit, sampling)

  // 3. Cache the result (best-effort — a DB outage must not fail the request)
  const cacheBytes = pool.length > 0 ? Buffer.byteLength(JSON.stringify(pool)) : 0

  if (pool.length > 0 && cacheBytes > EVOLUTION_MAX_CACHE_BYTES) {
    logger.evolution.warn(
      `Skipping cache write for ${cacheKey}: ${Math.round(cacheBytes / 1024 / 1024)}MB exceeds the blob cap`,
    )
  } else if (pool.length > 0) {
    const now = new Date()
    // Stamped with the repo state this pool was built from; the next request
    // compares against it instead of re-fetching on a timer.
    let pushedAt: Date | null = null
    try {
      pushedAt = new Date((await loadRepoInfo()).pushed_at)
    } catch (err) {
      logger.evolution.warn(`pushed_at unavailable for ${cacheKey}`, err)
    }

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
          pushedAt,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: evolutionSnapshots.id,
          set: {
            snapshots: pool,
            tagCount: pool.length,
            capturedAt: now,
            pushedAt,
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
