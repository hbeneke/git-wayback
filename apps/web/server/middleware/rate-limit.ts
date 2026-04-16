/**
 * Global rate limiting middleware.
 * Applies appropriate rate limits based on the endpoint being accessed.
 */
export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip rate limiting for non-API routes
  if (!path.startsWith('/api/')) {
    return
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
