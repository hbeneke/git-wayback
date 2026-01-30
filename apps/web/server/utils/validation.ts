import type { H3Event } from 'h3'
import { DISPLAY } from '@git-wayback/shared'

/**
 * GitHub username/organization name constraints:
 * - 1-39 characters
 * - Alphanumeric or hyphens
 * - Cannot start with a hyphen
 * - Cannot have consecutive hyphens
 */
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

/**
 * GitHub repository name constraints:
 * - 1-100 characters
 * - Alphanumeric, hyphens, underscores, and dots
 * - Cannot start with a dot
 * - Cannot be exactly "." or ".."
 */
const GITHUB_REPO_PATTERN = /^(?!\.)[a-zA-Z0-9._-]{1,100}$/

interface RepoParams {
  owner: string
  repo: string
}

/**
 * Validates a GitHub owner (username or organization) name.
 */
export function isValidGitHubOwner(owner: string): boolean {
  if (!owner || typeof owner !== 'string') {
    return false
  }
  return GITHUB_OWNER_PATTERN.test(owner)
}

/**
 * Validates a GitHub repository name.
 */
export function isValidGitHubRepo(repo: string): boolean {
  if (!repo || typeof repo !== 'string') {
    return false
  }
  if (repo === '.' || repo === '..') {
    return false
  }
  return GITHUB_REPO_PATTERN.test(repo)
}

/**
 * Validates and extracts owner/repo from route parameters.
 * Throws an H3 error if validation fails.
 */
export function validateRepoParams(event: H3Event): RepoParams {
  const params = getRouterParams(event)
  const owner = params.owner as string
  const repo = params.repo as string

  if (!isValidGitHubOwner(owner)) {
    throw createError({
      statusCode: 400,
      message: `Invalid GitHub owner: "${owner}". Must be 1-39 alphanumeric characters or hyphens.`,
    })
  }

  if (!isValidGitHubRepo(repo)) {
    throw createError({
      statusCode: 400,
      message: `Invalid repository name: "${repo}". Must be 1-100 valid characters.`,
    })
  }

  return { owner, repo }
}

/**
 * Validates a search query string.
 * Returns sanitized query or throws an error.
 */
export function validateSearchQuery(query: unknown): string {
  if (!query || typeof query !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Search query is required',
    })
  }

  const trimmed = query.trim()

  if (trimmed.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Search query must be at least 2 characters',
    })
  }

  if (trimmed.length > DISPLAY.MAX_SEARCH_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `Search query must not exceed ${DISPLAY.MAX_SEARCH_LENGTH} characters`,
    })
  }

  return trimmed
}

/**
 * Validates a git commit SHA.
 */
export function isValidCommitSha(sha: string): boolean {
  if (!sha || typeof sha !== 'string') {
    return false
  }
  // Git SHA can be 7-40 characters (short or full)
  return /^[a-f0-9]{7,40}$/i.test(sha)
}

/**
 * Validates and returns a commit SHA from query parameters.
 */
export function validateCommitSha(event: H3Event): string {
  const query = getQuery(event)
  const sha = query.sha as string

  if (!sha) {
    throw createError({
      statusCode: 400,
      message: 'sha query parameter is required',
    })
  }

  if (!isValidCommitSha(sha)) {
    throw createError({
      statusCode: 400,
      message: `Invalid commit SHA: "${sha}". Must be 7-40 hexadecimal characters.`,
    })
  }

  return sha
}
