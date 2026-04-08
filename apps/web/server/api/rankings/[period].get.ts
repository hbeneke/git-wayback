import { sql } from 'drizzle-orm'
import { createDb, repoVisits } from '@git-wayback/db'

export default defineEventHandler(async (event) => {
  const period = getRouterParam(event, 'period')
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  const db = createDb(getDatabaseUrl())

  const now = new Date()
  let dateFilter

  if (period === 'week') {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (period === 'month') {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else if (period !== 'popular') {
    throw createError({ statusCode: 400, message: 'Invalid period. Use: popular, month, week' })
  }

  const baseQuery = db
    .select({
      repoFullName: repoVisits.repoFullName,
      repoAvatar: sql<string | null>`MAX(${repoVisits.repoAvatar})`.as('repo_avatar'),
      visits: sql<number>`COUNT(*)::int`.as('visits'),
    })
    .from(repoVisits)

  const filtered = dateFilter
    ? baseQuery.where(sql`${repoVisits.visitedAt} >= ${dateFilter}`)
    : baseQuery

  const results = await filtered
    .groupBy(repoVisits.repoFullName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)
    .offset(offset)

  return results
})
