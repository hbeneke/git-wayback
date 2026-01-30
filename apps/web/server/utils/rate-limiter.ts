import type { H3Event } from 'h3'

/**
 * Rate limiter configuration.
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Custom key generator (defaults to IP-based) */
  keyGenerator?: (event: H3Event) => string
  /** Custom response when rate limited */
  message?: string
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory rate limit store.
 * In production, consider using Redis for distributed rate limiting.
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/** Cleanup interval for expired entries (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/** Track if cleanup is scheduled */
let cleanupScheduled = false

/**
 * Removes expired rate limit entries to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Schedules periodic cleanup of expired entries.
 */
function scheduleCleanup(): void {
  if (cleanupScheduled) return
  cleanupScheduled = true

  setInterval(() => {
    cleanupExpiredEntries()
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Extracts client IP from the request.
 */
function getClientIp(event: H3Event): string {
  const headers = getHeaders(event)

  // Check common proxy headers
  const forwarded = headers['x-forwarded-for']
  if (forwarded) {
    const ips = forwarded.split(',')
    return ips[0].trim()
  }

  const realIp = headers['x-real-ip']
  if (realIp) {
    return realIp
  }

  // Fallback to remote address
  return event.node.req.socket.remoteAddress || 'unknown'
}

/**
 * Default rate limit configurations for different endpoint types.
 */
export const RATE_LIMITS = {
  /** Standard API endpoints */
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Search endpoints (more expensive) */
  search: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Evolution data (GitHub API intensive) */
  evolution: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Health checks (lenient) */
  health: {
    maxRequests: 300,
    windowMs: 60 * 1000, // 1 minute
  },
} as const

/**
 * Checks and updates rate limit for a request.
 * Returns true if the request should be allowed, false if rate limited.
 */
export function checkRateLimit(
  event: H3Event,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  scheduleCleanup()

  const now = Date.now()
  const key = config.keyGenerator?.(event) ?? getClientIp(event)
  const prefixedKey = `${event.path}:${key}`

  let entry = rateLimitStore.get(prefixedKey)

  // Create new entry if doesn't exist or window has passed
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
  }

  entry.count++
  rateLimitStore.set(prefixedKey, entry)

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Applies rate limiting to an event handler.
 * Throws 429 Too Many Requests if limit exceeded.
 */
export function applyRateLimit(
  event: H3Event,
  config: RateLimitConfig = RATE_LIMITS.api
): void {
  const result = checkRateLimit(event, config)

  // Set rate limit headers
  setHeaders(event, {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  })

  if (!result.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: config.message ?? 'Rate limit exceeded. Please try again later.',
      data: {
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
    })
  }
}

/**
 * Creates a rate limit middleware for specific configurations.
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (event: H3Event) => applyRateLimit(event, config)
}
