import { eq } from 'drizzle-orm'
import { createDb, evolutionSnapshots, type EvolutionSnapshotData } from '@git-wayback/db'
import { EVOLUTION_CACHE_DURATION_MS, EVOLUTION, GITHUB_API } from '@git-wayback/shared'

interface GitHubTag {
  name: string
  commit: {
    sha: string
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

// Fetch all evolution data from GitHub
async function fetchFromGitHub(
  owner: string,
  repo: string,
  limit: number
): Promise<EvolutionSnapshotData[]> {
  const headers = getGitHubHeaders()

  // 1. Get all tags
  const tagsResponse = await $fetch<GitHubTag[]>(
    `https://api.github.com/repos/${owner}/${repo}/tags`,
    {
      headers,
      query: { per_page: limit },
    }
  )

  if (tagsResponse.length === 0) {
    return []
  }

  // 2. For each tag, get commit info and tree in parallel
  const snapshots: EvolutionSnapshotData[] = []

  // Process tags in batches to avoid rate limits
  for (let i = 0; i < tagsResponse.length; i += GITHUB_API.BATCH_SIZE) {
    const batch = tagsResponse.slice(i, i + GITHUB_API.BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (tag) => {
        try {
          // Get commit details and tree in parallel
          const [commitDetail, treeResponse] = await Promise.all([
            $fetch<GitHubCommitDetail>(
              `https://api.github.com/repos/${owner}/${repo}/commits/${tag.commit.sha}`,
              { headers }
            ),
            $fetch<GitHubTreeResponse>(
              `https://api.github.com/repos/${owner}/${repo}/git/trees/${tag.commit.sha}`,
              {
                headers,
                query: { recursive: '1' },
              }
            ),
          ])

          // Process files
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
            tag: tag.name,
            sha: tag.commit.sha,
            date: commitDetail.commit.author.date,
            message: commitDetail.commit.message.split('\n')[0],
            files,
            stats: {
              totalFiles: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0),
            },
          }
        } catch (err) {
          logger.evolution.warn(`Failed to fetch data for tag ${tag.name}`, err)
          return null
        }
      })
    )

    // Add successful results
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
  const limit = Math.min(Number(query.limit) || EVOLUTION.DEFAULT_LIMIT, EVOLUTION.MAX_LIMIT)
  const forceRefresh = query.refresh === 'true'

  const repoId = `${owner}/${repo}`
  const db = createDb(getDatabaseUrl())

  // 1. Check if we have cached data
  if (!forceRefresh) {
    const cached = await db
      .select()
      .from(evolutionSnapshots)
      .where(eq(evolutionSnapshots.id, repoId))
      .limit(1)

    if (cached.length > 0) {
      const cacheAge = Date.now() - new Date(cached[0].capturedAt).getTime()

      // If cache is still fresh, return it
      if (cacheAge < EVOLUTION_CACHE_DURATION_MS) {
        logger.evolution.debug(`Cache hit for ${repoId}`, { ageMinutes: Math.round(cacheAge / 1000 / 60) })
        return {
          snapshots: cached[0].snapshots,
          repoName: repo,
          cached: true,
          capturedAt: cached[0].capturedAt,
        }
      }

      logger.evolution.info(`Cache expired for ${repoId}, refreshing...`)
    }
  }

  // 2. Fetch from GitHub
  logger.evolution.info(`Fetching from GitHub: ${repoId}`)
  const snapshots = await fetchFromGitHub(owner, repo, limit)

  // 3. Save to database (upsert)
  if (snapshots.length > 0) {
    const now = new Date()

    await db
      .insert(evolutionSnapshots)
      .values({
        id: repoId,
        owner,
        name: repo,
        snapshots,
        tagCount: snapshots.length,
        capturedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: evolutionSnapshots.id,
        set: {
          snapshots,
          tagCount: snapshots.length,
          capturedAt: now,
          updatedAt: now,
        },
      })

    logger.evolution.success(`Saved ${snapshots.length} snapshots for ${repoId}`)
  }

  return {
    snapshots,
    repoName: repo,
    cached: false,
    capturedAt: new Date(),
  }
})
