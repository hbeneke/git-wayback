import { createHash } from 'node:crypto'

/**
 * Opaque per-day identifier for a visitor.
 *
 * The visits table only needs something stable enough to dedup a visitor on a
 * given day; it does not need the IP. Storing the raw address made every row
 * personal data retained indefinitely for no functional gain.
 *
 * The day is mixed in so the identifier rotates daily, and the salt is what
 * makes it irreversible — IPv4 is only 2^32 values, so an unsalted hash is
 * trivially enumerable.
 */
export function toVisitorId(ip: string, visitDay: string): string {
  return createHash('sha256')
    .update(`${getVisitorSalt()}:${visitDay}:${ip}`)
    .digest('hex')
    .slice(0, 32)
}
