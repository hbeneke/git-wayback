import { analyzeRepository } from '@git-wayback/core'

// In-memory store for analysis progress (in production, use Redis or DB)
const analysisStore = new Map<
  string,
  {
    status: string
    progress: number
    message: string
    result?: unknown
    startedAt: Date
  }
>()

export { analysisStore }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { owner, repo } = body

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'owner and repo are required',
    })
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) {
    throw createError({
      statusCode: 500,
      message: 'BLOB_READ_WRITE_TOKEN is not configured',
    })
  }

  const analysisKey = `${owner}/${repo}`

  // Check if already analyzing
  const existing = analysisStore.get(analysisKey)
  if (existing && existing.status !== 'completed' && existing.status !== 'failed') {
    return {
      key: analysisKey,
      ...existing,
      message: 'Analysis already in progress',
    }
  }

  // Initialize analysis state
  analysisStore.set(analysisKey, {
    status: 'pending',
    progress: 0,
    message: 'Starting analysis...',
    startedAt: new Date(),
  })

  // Start analysis in background (don't await)
  analyzeRepository({
    owner,
    repo,
    blobToken,
    maxCommits: 10,
    onStatusChange: (status, progress, message) => {
      analysisStore.set(analysisKey, {
        status,
        progress,
        message,
        startedAt: analysisStore.get(analysisKey)?.startedAt || new Date(),
      })
    },
  })
    .then((result) => {
      const current = analysisStore.get(analysisKey)
      analysisStore.set(analysisKey, {
        status: result.status,
        progress: 100,
        message: result.error || 'Analysis completed',
        result,
        startedAt: current?.startedAt || new Date(),
      })
    })
    .catch((error) => {
      const current = analysisStore.get(analysisKey)
      analysisStore.set(analysisKey, {
        status: 'failed',
        progress: 0,
        message: error.message,
        startedAt: current?.startedAt || new Date(),
      })
    })

  return {
    message: 'Analysis started',
    key: analysisKey,
    status: 'pending',
    progress: 0,
  }
})
