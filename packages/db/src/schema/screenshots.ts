import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { repositories } from './repositories'

export const screenshots = pgTable('screenshots', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  commitSha: text('commit_sha').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type Screenshot = typeof screenshots.$inferSelect
export type NewScreenshot = typeof screenshots.$inferInsert
