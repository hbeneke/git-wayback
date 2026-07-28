import { sql } from 'drizzle-orm'
import { date, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const repoVisits = pgTable(
  'repo_visits',
  {
    visitorId: text('visitor_id').notNull(),
    repoFullName: text('repo_full_name').notNull(),
    repoAvatar: text('repo_avatar'),
    // Day bucket (UTC, YYYY-MM-DD). One row per visitor+repo+day so window
    // rankings (week/month) count correctly and the table stays bounded.
    visitDay: date('visit_day').notNull().default(sql`CURRENT_DATE`),
    visitedAt: timestamp('visited_at').notNull().defaultNow(),
  },
  (table) => [
    unique('unique_visitor_repo_day').on(table.visitorId, table.repoFullName, table.visitDay),
    index('idx_repo_visits_visit_day').on(table.visitDay),
    index('idx_repo_visits_repo').on(table.repoFullName),
  ],
)

export type RepoVisit = typeof repoVisits.$inferSelect
export type NewRepoVisit = typeof repoVisits.$inferInsert
