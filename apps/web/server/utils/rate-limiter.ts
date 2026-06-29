import type { H3Event } from 'h3'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitConfig {
  maxRequests: number
  windowSec: number
  prefix: string
}

export const RATE_LIMITS = {
  /** Standard API endpoints */
  api: {
    maxRequests: 100,
    windowSec: 60,
    prefix: 'api',
  },
  /** Search endpoints (more expensive) */
  search: {
    maxRequests: 30,
    windowSec: 60,
    prefix: 'search',
  },
  /** Evolution data (GitHub API intensive) */
  evolution: {
    maxRequests: 20,
    windowSec: 60,
    prefix: 'evolution',
  },
  /** Visit tracking (strict to prevent ranking inflation) */
  visits: {
    maxRequests: 5,
    windowSec: 60,
    prefix: 'visits',
  },
  /** Health checks (lenient) */
  health: {
    maxRequests: 300,
    windowSec: 60,
    prefix: 'health',
  },
} as const

// null when Upstash isn't configured → callers skip rate limiting
function createUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const url = getEnvConfig().upstashRedisRestUrl
  const token = getEnvConfig().upstashRedisRestToken

  if (!url || !token) {
    return null
  }

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSec} s`),
    prefix: `ratelimit:${config.prefix}`,
  })
}

const limiterCache = new Map<string, Ratelimit | null>()

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!limiterCache.has(config.prefix)) {
    limiterCache.set(config.prefix, createUpstashLimiter(config))
  }
  return limiterCache.get(config.prefix)!
}

export async function applyRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<void> {
  const limiter = getLimiter(config)

  if (!limiter) {
    // Upstash not configured — skip rate limiting (dev mode)
    return
  }

  const ip = getTrustedClientIp(event)
  const { success, remaining, reset } = await limiter.limit(ip)

  setHeaders(event, {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(reset / 1000)),
  })

  if (!success) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      data: {
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
    })
  }
}
