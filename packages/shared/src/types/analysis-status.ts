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
