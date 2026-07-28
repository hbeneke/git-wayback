import { lt } from 'drizzle-orm'
import { createDb, evolutionSnapshots } from '@git-wayback/db'
import { EVOLUTION_CACHE_RETENTION_MS } from '@git-wayback/shared'

/**
 * Deletes evolution cache rows nobody has asked for in a while.
 *
 * The 24h expiry only decides whether a row is refreshed — it never removes
 * one, so the table grew by (source x sampling x limit x branch) per repo and
 * stayed that size forever.
 *
 * GET because Vercel cron jobs only issue GET. Authenticated with CRON_SECRET,
 * which Vercel sends as a bearer token; unset means nobody gets in.
 */
export default defineEventHandler(async (event) => {
  const secret = getCronSecret()

  if (!secret) {
    throw createError({ statusCode: 404, message: 'Not found.' })
  }

  if (getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const cutoff = new Date(Date.now() - EVOLUTION_CACHE_RETENTION_MS)
  const db = createDb(getDatabaseUrl())

  const deleted = await db
    .delete(evolutionSnapshots)
    .where(lt(evolutionSnapshots.capturedAt, cutoff))
    .returning({ id: evolutionSnapshots.id })

  logger.evolution.info(`Purged ${deleted.length} cache rows older than ${cutoff.toISOString()}`)

  return { purged: deleted.length, cutoff: cutoff.toISOString() }
})
