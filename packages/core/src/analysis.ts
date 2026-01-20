import type { SimpleGit } from 'simple-git'
import { cloneRepository, getGitInstance, repositoryExists } from './git'
import { takeMultipleScreenshots, closeBrowser, type ScreenshotResult } from './screenshot'

export interface AnalysisConfig {
  owner: string
  repo: string
  blobToken: string
  maxCommits?: number // Limit number of commits to analyze (for performance)
  onStatusChange?: (status: AnalysisStatus, progress: number, message: string) => void
}

export type AnalysisStatus =
  | 'pending'
  | 'cloning'
  | 'analyzing'
  | 'screenshots'
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
  screenshots: ScreenshotResult[]
  error?: string
}

/**
 * Get commits from the repository, sampling evenly for screenshots
 */
async function getCommitsForScreenshots(
  git: SimpleGit,
  maxCommits: number
): Promise<CommitInfo[]> {
  // Get all commits on default branch
  const log = await git.log(['--first-parent'])
  const allCommits = log.all

  if (allCommits.length === 0) {
    return []
  }

  // If we have fewer commits than max, return all
  if (allCommits.length <= maxCommits) {
    return allCommits.map((c) => ({
      sha: c.hash,
      message: c.message,
      authorName: c.author_name,
      authorEmail: c.author_email,
      authorDate: new Date(c.date),
      committerName: c.author_name, // simple-git doesn't separate committer
      committerEmail: c.author_email,
      committerDate: new Date(c.date),
    }))
  }

  // Sample commits evenly across the history
  // Always include first and last commit
  const indices: number[] = [0]
  const step = (allCommits.length - 1) / (maxCommits - 1)

  for (let i = 1; i < maxCommits - 1; i++) {
    indices.push(Math.round(i * step))
  }
  indices.push(allCommits.length - 1)

  // Remove duplicates and sort
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b)

  return uniqueIndices.map((idx) => {
    const c = allCommits[idx]
    return {
      sha: c.hash,
      message: c.message,
      authorName: c.author_name,
      authorEmail: c.author_email,
      authorDate: new Date(c.date),
      committerName: c.author_name,
      committerEmail: c.author_email,
      committerDate: new Date(c.date),
    }
  })
}

/**
 * Run full analysis on a repository
 */
export async function analyzeRepository(config: AnalysisConfig): Promise<AnalysisResult> {
  const { owner, repo, blobToken, maxCommits = 10, onStatusChange } = config

  const updateStatus = (status: AnalysisStatus, progress: number, message: string) => {
    onStatusChange?.(status, progress, message)
  }

  try {
    // Step 1: Clone or verify repository exists
    updateStatus('cloning', 0, 'Checking repository...')

    let repoPath: string
    const exists = await repositoryExists(owner, repo)

    if (!exists) {
      updateStatus('cloning', 10, 'Cloning repository...')
      repoPath = await cloneRepository({ owner, repo })
    } else {
      repoPath = `.repos/${owner}/${repo}`
      updateStatus('cloning', 20, 'Repository already exists, using cached version...')
    }

    // Step 2: Analyze commits
    updateStatus('analyzing', 30, 'Analyzing commit history...')

    const git = getGitInstance(repoPath)
    const commits = await getCommitsForScreenshots(git, maxCommits)

    if (commits.length === 0) {
      throw new Error('No commits found in repository')
    }

    updateStatus('analyzing', 40, `Found ${commits.length} commits to capture...`)

    // Step 3: Take screenshots
    updateStatus('screenshots', 50, 'Starting screenshot capture...')

    const commitShas = commits.map((c) => c.sha)
    const screenshots = await takeMultipleScreenshots(
      owner,
      repo,
      commitShas,
      blobToken,
      (current, total, _result) => {
        const progress = 50 + Math.round((current / total) * 45)
        updateStatus('screenshots', progress, `Capturing screenshot ${current}/${total}...`)
      }
    )

    // Cleanup
    await closeBrowser()

    updateStatus('completed', 100, 'Analysis completed!')

    return {
      status: 'completed',
      commits,
      screenshots,
    }
  } catch (error) {
    await closeBrowser()

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    updateStatus('failed', 0, `Analysis failed: ${errorMessage}`)

    return {
      status: 'failed',
      commits: [],
      screenshots: [],
      error: errorMessage,
    }
  }
}
