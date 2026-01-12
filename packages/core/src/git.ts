import fs from 'node:fs/promises'
import path from 'node:path'
import { type SimpleGit, simpleGit } from 'simple-git'

const REPOS_DIR = process.env.REPOS_DIR || '.repos'

export interface CloneOptions {
  owner: string
  repo: string
  depth?: number
}

export async function cloneRepository(options: CloneOptions): Promise<string> {
  const { owner, repo, depth } = options
  const repoPath = path.join(REPOS_DIR, owner, repo)

  await fs.mkdir(path.dirname(repoPath), { recursive: true })

  const git = simpleGit()
  const url = `https://github.com/${owner}/${repo}.git`

  const cloneOptions = depth ? ['--depth', String(depth)] : []

  await git.clone(url, repoPath, cloneOptions)

  return repoPath
}

export function getGitInstance(repoPath: string): SimpleGit {
  return simpleGit(repoPath)
}

export async function repositoryExists(owner: string, repo: string): Promise<boolean> {
  const repoPath = path.join(REPOS_DIR, owner, repo)
  try {
    await fs.access(repoPath)
    return true
  } catch {
    return false
  }
}
