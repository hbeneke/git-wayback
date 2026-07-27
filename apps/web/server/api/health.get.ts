export default defineEventHandler(() => {
  const checks = {
    config: isConfigValid(),
    // Reported because a missing limiter used to be invisible: the endpoint
    // answered "healthy" while every rate limit was silently skipped.
    rateLimiter: isRateLimitConfigured(),
  }

  const healthy = Object.values(checks).every(Boolean)

  return {
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }
})
