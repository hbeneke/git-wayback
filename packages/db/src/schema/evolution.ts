import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { repositories } from './repositories'

// Stores the evolution snapshots for each repository
export const evolutionSnapshots = pgTable(
  'evolution_snapshots',
  {
    id: text('id').primaryKey(), // format: owner/repo
    repositoryId: text('repository_id').references(() => repositories.id),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    // JSON array of all tag snapshots with their file trees
    snapshots: jsonb('snapshots').notNull().$type<EvolutionSnapshotData[]>(),
    // When this data was last fetched from GitHub
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
    // Number of tags captured
    tagCount: integer('tag_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('evolution_owner_name_idx').on(table.owner, table.name),
  ]
)

// Type for the snapshot data stored in JSONB
export interface EvolutionSnapshotData {
  tag: string
  sha: string
  date: string
  message: string
  files: {
    path: string
    name: string
    size: number
    extension: string | null
  }[]
  stats: {
    totalFiles: number
    totalSize: number
  }
}

export type EvolutionSnapshot = typeof evolutionSnapshots.$inferSelect
export type NewEvolutionSnapshot = typeof evolutionSnapshots.$inferInsert
