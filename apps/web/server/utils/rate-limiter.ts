import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { H3Event } from 'h3'

export interface RateLimitConfig {
  maxRequests: number
  windowSec: number
  prefix: string
  /**
   * Let requests through when the limiter is unavailable instead of failing
   * closed. Only for endpoints whose whole job is reporting that outage.
   */
  failOpen?: boolean
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
  /**
   * Forced cache refresh, per IP. Every one of these skips the cache and costs
   * real GitHub quota, so it is the strictest per-client budget in the app.
   */
  refresh: {
    maxRequests: 5,
    windowSec: 3600,
    prefix: 'refresh',
  },
  /**
   * Forced cache refresh, counted across every client at once (fixed identity).
   * The per-IP budget alone is meaningless against a botnet; this is the hard
   * ceiling on how much of the hourly GitHub quota forced refreshes can burn.
   */
  refreshGlobal: {
    maxRequests: 60,
    windowSec: 3600,
    prefix: 'refresh-global',
  },
  /** Visit tracking (strict to prevent ranking inflation) */
  visits: {
    maxRequests: 5,
    windowSec: 60,
    prefix: 'visits',
  },
  /** Health checks (lenient, and must answer even when the limiter is down) */
  health: {
    maxRequests: 300,
    windowSec: 60,
    prefix: 'health',
    failOpen: true,
  },
} as const

// null when Upstash isn't configured. In development that means "no limiting";
// in production it is a deploy misconfiguration and applyRateLimit fails closed.
function createUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const url = getEnvConfig().upstashRedisRestUrl
  const token = getEnvConfig().upstashRedisRestToken

  if (!url || !token) {
    // Logged once per prefix — getLimiter caches the null.
    logger.rateLimit[isProduction() ? 'error' : 'debug'](
      `Upstash not configured — "${config.prefix}" limiter unavailable`,
    )
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

/**
 * Raised when the limiter cannot answer. Kept as 503 rather than letting the
 * request through: an unavailable limiter is indistinguishable from one being
 * drained by an attacker, and this endpoint set is cheap to abuse.
 */
function unavailable(): never {
  throw createError({
    statusCode: 503,
    statusMessage: 'Service Unavailable',
    message: 'Rate limiting is unavailable. Please try again later.',
  })
}

/**
 * `identity` overrides the per-IP bucket key. Passing a constant turns the
 * limiter into a global budget shared by every caller.
 */
export async function applyRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.api,
  identity?: string,
): Promise<void> {
  const limiter = getLimiter(config)

  if (!limiter) {
    // Dev keeps working without Upstash; production must not silently drop the
    // only protection the write and GitHub-backed endpoints have.
    if (isProduction() && !config.failOpen) unavailable()
    return
  }

  const key = identity ?? getTrustedClientIp(event)

  let success: boolean
  let remaining: number
  let reset: number

  try {
    ;({ success, remaining, reset } = await limiter.limit(key))
  } catch (err) {
    logger.rateLimit.error(`Limiter "${config.prefix}" failed for ${key}`, err)
    if (isProduction() && !config.failOpen) unavailable()
    return
  }

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
