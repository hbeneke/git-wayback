import type { H3Event } from 'h3'

/**
 * Whether the caller asked to bypass the cache (`?refresh=1`).
 *
 * Only exact "1" counts, so a stray `?refresh=0` or `?refresh` cannot bust the
 * cache by accident. GET only: the flag costs GitHub quota, and honouring it on
 * any other method would make it reachable from a cross-site form post.
 *
 * The rate-limit middleware charges every forced refresh against a strict
 * per-IP budget and a global one before the handler sees it.
 */
export function isForcedRefresh(event: H3Event): boolean {
  if (event.method !== 'GET') return false
  return getQuery(event).refresh === '1'
}
