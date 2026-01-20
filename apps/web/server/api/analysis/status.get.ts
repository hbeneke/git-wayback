import { analysisStore } from './start.post'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const { owner, repo } = query

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'owner and repo query parameters are required',
    })
  }

  const analysisKey = `${owner}/${repo}`
  const analysis = analysisStore.get(analysisKey)

  if (!analysis) {
    return {
      status: 'not_found',
      progress: 0,
      message: 'No analysis found for this repository',
    }
  }

  return {
    key: analysisKey,
    status: analysis.status,
    progress: analysis.progress,
    message: analysis.message,
    result: analysis.result,
    startedAt: analysis.startedAt,
  }
})
