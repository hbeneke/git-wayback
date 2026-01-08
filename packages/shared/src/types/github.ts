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
