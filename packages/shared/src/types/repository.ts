import type { AnalysisStatus } from './analysis-status'

/**
 * Main repository entity
 */
export interface Repository {
  id: string
  owner: string
  name: string
  fullName: string
  description: string | null
  defaultBranch: string
  lastGithubSha: string | null
  lastAnalyzedSha: string | null
  status: AnalysisStatus
  analysisProgress: number
  starsCount: number
  forksCount: number
  createdAt: Date
  updatedAt: Date
}
