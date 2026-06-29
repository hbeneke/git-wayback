import type { H3Event } from 'h3'
import { DISPLAY } from '@git-wayback/shared'

// 1-39 chars, alphanumeric or hyphens, no leading/trailing/consecutive hyphen
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

// 1-100 chars, alphanumeric/hyphen/underscore/dot, no leading dot
const GITHUB_REPO_PATTERN = /^(?!\.)[a-zA-Z0-9._-]{1,100}$/

interface RepoParams {
  owner: string
  repo: string
}

export function isValidGitHubOwner(owner: string): boolean {
  return GITHUB_OWNER_PATTERN.test(owner)
}

export function isValidGitHubRepo(repo: string): boolean {
  return GITHUB_REPO_PATTERN.test(repo)
}

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

// git check-ref-format rules: no traversal, control chars, or forbidden tokens
export function isValidGitRef(ref: string): boolean {
  if (!ref) {
    return false
  }
  if (ref.length > 255) {
    return false
  }
  // No ASCII control chars, space, or any of: ~ ^ : ? * [ \
  // biome-ignore lint/suspicious/noControlCharactersInRegex: git forbids them
  if (/[\x00-\x20\x7f ~^:?*[\\]/.test(ref)) {
    return false
  }
  // No "..", no "@{", not a lone "@"
  if (ref.includes('..') || ref.includes('@{') || ref === '@') {
    return false
  }
  // No leading/trailing slash, no consecutive slashes
  if (ref.startsWith('/') || ref.endsWith('/') || ref.includes('//')) {
    return false
  }
  // Cannot end with "." or ".lock"
  if (ref.endsWith('.') || ref.endsWith('.lock')) {
    return false
  }
  // No path component may start with "."
  if (ref.split('/').some((part) => part.startsWith('.'))) {
    return false
  }
  return true
}

export function isValidCommitSha(sha: string): boolean {
  return /^[a-f0-9]{7,40}$/i.test(sha)
}

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
