import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Caches the evolution snapshots computed for a repository.
//
// No secondary index: every read is a primary-key lookup on `id`. The old
// (owner, name) index was never consulted and only cost writes.
export const evolutionSnapshots = pgTable('evolution_snapshots', {
  // Cache key, not just the repo: "owner/repo#source#branch#sampling#limit".
  // Every input that changes the result set is part of it.
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  // JSON array of all tag snapshots with their file trees
  snapshots: jsonb('snapshots').notNull().$type<EvolutionSnapshotData[]>(),
  // When this data was last fetched from GitHub
  capturedAt: timestamp('captured_at').notNull().defaultNow(),
  // Repo `pushed_at` at capture time. Unchanged value means no new commits, so
  // the row is still correct and can be served without refetching. Nullable:
  // rows captured before this column existed have no value.
  pushedAt: timestamp('pushed_at'),
  // Number of tags captured
  tagCount: integer('tag_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

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
  /**
   * GitHub recursive tree was truncated for this snapshot — file list is
   * incomplete. Optional for backward compatibility with rows captured before
   * the flag was tracked.
   */
  truncated?: boolean
}

export type EvolutionSnapshot = typeof evolutionSnapshots.$inferSelect
export type NewEvolutionSnapshot = typeof evolutionSnapshots.$inferInsert
