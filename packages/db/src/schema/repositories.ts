import { integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const analysisStatusEnum = pgEnum('analysis_status', [
  'pending',
  'cloning',
  'analyzing',
  'screenshots',
  'completed',
  'failed',
])

export const repositories = pgTable('repositories', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull().unique(),
  description: text('description'),
  defaultBranch: text('default_branch').notNull().default('main'),
  lastGithubSha: text('last_github_sha'),
  lastAnalyzedSha: text('last_analyzed_sha'),
  status: analysisStatusEnum('status').notNull().default('pending'),
  analysisProgress: integer('analysis_progress').notNull().default(0),
  starsCount: integer('stars_count').notNull().default(0),
  forksCount: integer('forks_count').notNull().default(0),
  basicData: jsonb('basic_data'),
  deepAnalysis: jsonb('deep_analysis'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Repository = typeof repositories.$inferSelect
export type NewRepository = typeof repositories.$inferInsert
