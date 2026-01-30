import type { SimpleGit } from 'simple-git'
import { cloneRepository, getGitInstance, repositoryExists } from './git'

export interface AnalysisConfig {
  owner: string
  repo: string
  maxCommits?: number
  onStatusChange?: (status: AnalysisStatus, progress: number, message: string) => void
}

export type AnalysisStatus =
  | 'pending'
  | 'cloning'
  | 'analyzing'
  | 'completed'
  | 'failed'

export interface CommitInfo {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  authorDate: Date
  committerName: string
  committerEmail: string
  committerDate: Date
}

export interface AnalysisResult {
  status: AnalysisStatus
  commits: CommitInfo[]
  error?: string
}

/**
 * Retrieves commits from the repository, evenly sampled across history.
 * Always includes the first and last commit.
 */
async function getSampledCommits(
  git: SimpleGit,
  maxCommits: number
): Promise<CommitInfo[]> {
  const log = await git.log(['--first-parent'])
  const allCommits = log.all

  if (allCommits.length === 0) {
    return []
  }

  if (allCommits.length <= maxCommits) {
    return allCommits.map(mapCommit)
  }

  const indices = calculateSampleIndices(allCommits.length, maxCommits)
  return indices.map((idx) => mapCommit(allCommits[idx]))
}

/**
 * Calculates evenly distributed indices for sampling.
 */
function calculateSampleIndices(total: number, sampleSize: number): number[] {
  const indices: number[] = [0]
  const step = (total - 1) / (sampleSize - 1)

  for (let i = 1; i < sampleSize - 1; i++) {
    indices.push(Math.round(i * step))
  }
  indices.push(total - 1)

  return [...new Set(indices)].sort((a, b) => a - b)
}

/**
 * Maps a simple-git commit to our CommitInfo interface.
 */
function mapCommit(commit: {
  hash: string
  message: string
  author_name: string
  author_email: string
  date: string
}): CommitInfo {
  return {
    sha: commit.hash,
    message: commit.message,
    authorName: commit.author_name,
    authorEmail: commit.author_email,
    authorDate: new Date(commit.date),
    committerName: commit.author_name,
    committerEmail: commit.author_email,
    committerDate: new Date(commit.date),
  }
}

/**
 * Runs repository analysis: clones if needed and extracts commit history.
 */
export async function analyzeRepository(config: AnalysisConfig): Promise<AnalysisResult> {
  const { owner, repo, maxCommits = 10, onStatusChange } = config

  const updateStatus = (status: AnalysisStatus, progress: number, message: string) => {
    onStatusChange?.(status, progress, message)
  }

  try {
    updateStatus('cloning', 0, 'Checking repository...')

    let repoPath: string
    const exists = await repositoryExists(owner, repo)

    if (exists) {
      repoPath = `.repos/${owner}/${repo}`
      updateStatus('cloning', 20, 'Using cached repository...')
    } else {
      updateStatus('cloning', 10, 'Cloning repository...')
      repoPath = await cloneRepository({ owner, repo })
    }

    updateStatus('analyzing', 40, 'Analyzing commit history...')

    const git = getGitInstance(repoPath)
    const commits = await getSampledCommits(git, maxCommits)

    if (commits.length === 0) {
      throw new Error('No commits found in repository')
    }

    updateStatus('completed', 100, `Analysis completed with ${commits.length} commits`)

    return {
      status: 'completed',
      commits,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    updateStatus('failed', 0, `Analysis failed: ${errorMessage}`)

    return {
      status: 'failed',
      commits: [],
      error: errorMessage,
    }
  }
}
