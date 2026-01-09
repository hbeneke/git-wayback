/**
 * Analysis status for a repository
 */
export type AnalysisStatus =
  | 'pending'
  | 'cloning'
  | 'analyzing'
  | 'screenshots'
  | 'completed'
  | 'failed'

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

/**
 * Commit information
 */
export interface Commit {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  authorDate: Date
  committerName: string
  committerEmail: string
  committerDate: Date
  parentShas: string[]
}

/**
 * Branch information
 */
export interface Branch {
  name: string
  sha: string
  isDefault: boolean
}

/**
 * Contributor statistics
 */
export interface Contributor {
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  firstCommitDate: Date
  lastCommitDate: Date
}

/**
 * Screenshot of a repository at a specific commit
 */
export interface Screenshot {
  id: string
  repositoryId: string
  commitSha: string
  url: string
  createdAt: Date
}

/**
 * Basic repository data from GitHub API
 */
export interface GitHubRepoBasicData {
  id: number
  fullName: string
  description: string | null
  defaultBranch: string
  starsCount: number
  forksCount: number
  watchersCount: number
  openIssuesCount: number
  language: string | null
  topics: string[]
  createdAt: string
  updatedAt: string
  pushedAt: string
}

/**
 * Deep analysis result
 */
export interface DeepAnalysis {
  totalCommits: number
  totalBranches: number
  totalContributors: number
  firstCommitDate: Date
  lastCommitDate: Date
  mostModifiedFiles: Array<{
    path: string
    changes: number
  }>
  commitsByDay: Record<string, number>
  commitsByHour: Record<number, number>
}
