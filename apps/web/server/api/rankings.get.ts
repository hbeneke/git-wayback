import { sql } from 'drizzle-orm'
import { createDb, repoVisits } from '@git-wayback/db'

interface RankedRepo {
  repoFullName: string
  repoAvatar: string | null
  visits: number
}

export default defineEventHandler(async () => {
  const db = createDb(getDatabaseUrl())

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [popular, popularMonth, popularWeek] = await Promise.all([
    db
      .select({
        repoFullName: repoVisits.repoFullName,
        repoAvatar: sql<string | null>`MAX(${repoVisits.repoAvatar})`.as('repo_avatar'),
        visits: sql<number>`COUNT(*)::int`.as('visits'),
      })
      .from(repoVisits)
      .groupBy(repoVisits.repoFullName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    db
      .select({
        repoFullName: repoVisits.repoFullName,
        repoAvatar: sql<string | null>`MAX(${repoVisits.repoAvatar})`.as('repo_avatar'),
        visits: sql<number>`COUNT(*)::int`.as('visits'),
      })
      .from(repoVisits)
      .where(sql`${repoVisits.visitedAt} >= ${oneMonthAgo}`)
      .groupBy(repoVisits.repoFullName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    db
      .select({
        repoFullName: repoVisits.repoFullName,
        repoAvatar: sql<string | null>`MAX(${repoVisits.repoAvatar})`.as('repo_avatar'),
        visits: sql<number>`COUNT(*)::int`.as('visits'),
      })
      .from(repoVisits)
      .where(sql`${repoVisits.visitedAt} >= ${oneWeekAgo}`)
      .groupBy(repoVisits.repoFullName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),
  ])

  return {
    popular: popular as RankedRepo[],
    popularMonth: popularMonth as RankedRepo[],
    popularWeek: popularWeek as RankedRepo[],
  }
})
