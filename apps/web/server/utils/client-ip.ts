import type { H3Event } from 'h3'

/**
 * Resolves the client IP from headers injected by the hosting platform.
 *
 * On Vercel, `x-vercel-forwarded-for` and `x-real-ip` are set by the platform
 * and cannot be overridden by the client. The raw `x-forwarded-for` header IS
 * attacker-controlled (any client can send it), so it is intentionally NOT
 * trusted here — relying on it would let callers spoof their identity to
 * bypass rate limits and inflate visit counts.
 */
export function getTrustedClientIp(event: H3Event): string {
  const headers = getHeaders(event)

  const vercelForwarded = headers['x-vercel-forwarded-for']
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim()
  }

  const realIp = headers['x-real-ip']
  if (realIp) {
    return realIp.split(',')[0].trim()
  }

  return event.node.req.socket.remoteAddress || 'unknown'
}
