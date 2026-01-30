/**
 * GitHub API utilities for server-side requests.
 */

const GITHUB_API_VERSION = 'application/vnd.github.v3+json'
const USER_AGENT = 'git-wayback'

export type GitHubHeaders = Record<string, string>

/**
 * Builds headers for GitHub API requests.
 * Automatically includes authorization if GITHUB_TOKEN is configured.
 */
export function getGitHubHeaders(): GitHubHeaders {
  const headers: GitHubHeaders = {
    Accept: GITHUB_API_VERSION,
    'User-Agent': USER_AGENT,
  }

  const token = getGitHubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

/**
 * Constructs a GitHub API URL for a repository resource.
 */
export function buildRepoApiUrl(
  owner: string,
  repo: string,
  path = ''
): string {
  const base = `https://api.github.com/repos/${owner}/${repo}`
  return path ? `${base}/${path}` : base
}
