import { boolean, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { repositories } from './repositories'

export const branches = pgTable(
  'branches',
  {
    repositoryId: text('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sha: text('sha').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.name] })],
)

export type Branch = typeof branches.$inferSelect
export type NewBranch = typeof branches.$inferInsert
