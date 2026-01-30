/**
 * Global rate limiting middleware.
 * Applies appropriate rate limits based on the endpoint being accessed.
 */
export default defineEventHandler((event) => {
  const path = event.path

  // Skip rate limiting for non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Apply specific rate limits based on endpoint type
  if (path === '/api/health') {
    applyRateLimit(event, RATE_LIMITS.health)
  } else if (path === '/api/search') {
    applyRateLimit(event, RATE_LIMITS.search)
  } else if (path.includes('/evolution')) {
    applyRateLimit(event, RATE_LIMITS.evolution)
  } else {
    applyRateLimit(event, RATE_LIMITS.api)
  }
})
