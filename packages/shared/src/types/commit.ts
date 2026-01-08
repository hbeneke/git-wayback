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
