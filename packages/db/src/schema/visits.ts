import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const repoVisits = pgTable(
  'repo_visits',
  {
    visitorId: text('visitor_id').notNull(),
    repoFullName: text('repo_full_name').notNull(),
    repoAvatar: text('repo_avatar'),
    visitedAt: timestamp('visited_at').notNull().defaultNow(),
  },
  (table) => [
    unique('unique_visitor_repo').on(table.visitorId, table.repoFullName),
    index('idx_repo_visits_visited_at').on(table.visitedAt),
    index('idx_repo_visits_repo').on(table.repoFullName),
  ]
)

export type RepoVisit = typeof repoVisits.$inferSelect
export type NewRepoVisit = typeof repoVisits.$inferInsert
