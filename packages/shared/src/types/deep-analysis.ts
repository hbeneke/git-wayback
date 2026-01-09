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
