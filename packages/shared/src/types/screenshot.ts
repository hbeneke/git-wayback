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
