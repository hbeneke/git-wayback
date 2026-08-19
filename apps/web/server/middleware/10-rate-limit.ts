/**
 * Global rate limiting middleware.
 * Applies appropriate rate limits based on the endpoint being accessed.
 *
 * Runs after 00-security-headers so its 429/503 responses keep those headers.
 */
// Repo overview and evolution only: "/api/repos/<owner>/<repo>[/evolution]".
const REFRESHABLE_PATHS = /^\/api\/repos\/[^/?]+\/[^/?]+(\/evolution)?(\?|$)/

export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip rate limiting for non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // A forced refresh is the only way to make an endpoint hit GitHub on demand,
  // so it is budgeted twice before the normal limit even runs: once per IP,
  // once across all callers. Unknown routes never honour ?refresh, so anything
  // reaching the handlers has already paid for it here.
  if (isForcedRefresh(event)) {
    if (!REFRESHABLE_PATHS.test(path)) {
      throw createError({
        statusCode: 400,
        message: 'This endpoint does not support refresh.',
      })
    }

    await applyRateLimit(event, RATE_LIMITS.refresh)
    await applyRateLimit(event, RATE_LIMITS.refreshGlobal, 'global')
  }

  // Apply specific rate limits based on endpoint type
  if (path === '/api/health') {
    await applyRateLimit(event, RATE_LIMITS.health)
  } else if (path === '/api/search') {
    await applyRateLimit(event, RATE_LIMITS.search)
  } else if (path === '/api/visits') {
    await applyRateLimit(event, RATE_LIMITS.visits)
  } else if (path.includes('/evolution')) {
    await applyRateLimit(event, RATE_LIMITS.evolution)
  } else {
    await applyRateLimit(event, RATE_LIMITS.api)
  }
})
