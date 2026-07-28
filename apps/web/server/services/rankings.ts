import { sql } from 'drizzle-orm'
import { createDb, repoVisits } from '@git-wayback/db'
import { MS_PER_DAY } from '@git-wayback/shared'

export const RANKING_PERIODS = ['popular', 'month', 'week'] as const
export type RankingPeriod = (typeof RANKING_PERIODS)[number]

export interface RankedRepo {
  repoFullName: string
  repoAvatar: string | null
  visits: number
}

export interface RankingOptions {
  limit?: number
  offset?: number
}

export const RANKING_DEFAULT_LIMIT = 50
export const RANKING_MAX_LIMIT = 100

/** Days of history each period covers; 'popular' is all-time. */
const PERIOD_WINDOW_DAYS: Record<RankingPeriod, number | null> = {
  popular: null,
  month: 30,
  week: 7,
}

export function isRankingPeriod(value: unknown): value is RankingPeriod {
  return RANKING_PERIODS.includes(value as RankingPeriod)
}

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Visit counts per repo for one period, most visited first.
 *
 * This query used to be written out four times — three inline in the summary
 * endpoint and once in the per-period one — differing only by the day filter.
 */
export async function getRanking(
  period: RankingPeriod,
  { limit = RANKING_DEFAULT_LIMIT, offset = 0 }: RankingOptions = {}
): Promise<RankedRepo[]> {
  const db = createDb(getDatabaseUrl())
  const windowDays = PERIOD_WINDOW_DAYS[period]

  const query = db
    .select({
      repoFullName: repoVisits.repoFullName,
      repoAvatar: sql<string | null>`MAX(${repoVisits.repoAvatar})`.as('repo_avatar'),
      visits: sql<number>`COUNT(*)::int`.as('visits'),
    })
    .from(repoVisits)

  const filtered = windowDays
    ? query.where(sql`${repoVisits.visitDay} >= ${dayString(new Date(Date.now() - windowDays * MS_PER_DAY))}`)
    : query

  return filtered
    .groupBy(repoVisits.repoFullName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)
    .offset(offset)
}

/** Clamps caller-supplied paging into the range Postgres will accept. */
export function normalizePaging(rawLimit: unknown, rawOffset: unknown): Required<RankingOptions> {
  return {
    limit: Math.min(Math.max(Number(rawLimit) || RANKING_DEFAULT_LIMIT, 1), RANKING_MAX_LIMIT),
    offset: Math.max(Number(rawOffset) || 0, 0),
  }
}
