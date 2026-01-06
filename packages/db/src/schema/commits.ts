import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { repositories } from './repositories'

export const commits = pgTable('commits', {
  sha: text('sha').primaryKey(),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  authorDate: timestamp('author_date').notNull(),
  committerName: text('committer_name').notNull(),
  committerEmail: text('committer_email').notNull(),
  committerDate: timestamp('committer_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const commitParents = pgTable(
  'commit_parents',
  {
    commitSha: text('commit_sha')
      .notNull()
      .references(() => commits.sha, { onDelete: 'cascade' }),
    parentSha: text('parent_sha').notNull(),
  },
  (table) => [primaryKey({ columns: [table.commitSha, table.parentSha] })]
)

export type Commit = typeof commits.$inferSelect
export type NewCommit = typeof commits.$inferInsert
