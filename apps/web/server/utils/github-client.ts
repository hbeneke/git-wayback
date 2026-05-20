/**
 * Single access point for the GitHub REST API.
 *
 * - Builds URLs + auth headers in one place.
 * - Errors are mapped once: 404 -> 404 (not found), 403/429 -> 429 (GitHub
 *   rate limit, distinct message), anything else -> 502 (upstream failure).
 *   A missing repo and a rate-limited request no longer collapse into the
 *   same "Repository not found" message in the UI.
 * - All GitHub response shapes live here (no more duplicated interfaces
 *   across endpoints).
 */

const API_BASE = 'https://api.github.com'
const GITHUB_API_ACCEPT = 'application/vnd.github.v3+json'
const USER_AGENT = 'git-wayback'

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: GITHUB_API_ACCEPT,
    'User-Agent': USER_AGENT,
  }
  const token = getGitHubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

// --- Response shapes -------------------------------------------------------

export interface GhRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  homepage: string | null
  stargazers_count: number
  watchers_count: number
  forks_count: number
  open_issues_count: number
  size: number
  default_branch: string
  created_at: string
  updated_at: string
  pushed_at: string
  license?: { name: string; spdx_id: string } | null
  topics: string[]
  visibility: string
  archived: boolean
  disabled: boolean
}

export interface GhContributor {
  login: string
  avatar_url: string
  contributions: number
  html_url: string
}

export interface GhCommitListItem {
  sha: string
  commit: {
    message: string
    author: { name: string; email: string; date: string }
    committer: { name: string; date: string }
  }
  author?: { login: string; avatar_url: string }
}

export interface GhBranch {
  name: string
}

export interface GhRelease {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  prerelease: boolean
}

export type GhLanguages = Record<string, number>

export interface GhTag {
  name: string
  commit: { sha: string }
}

export interface GhRef {
  ref: string
  object: { sha: string; type: 'commit' | 'tag' }
}

export interface GhAnnotatedTag {
  tag: string
  message: string
  object: { sha: string; type: string }
}

export interface GhCommitDetail {
  sha: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
}

export interface GhTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

export interface GhTreeResponse {
  sha: string
  tree: GhTreeItem[]
  truncated: boolean
}

export interface GhSearchResponse {
  total_count: number
  items: Array<{
    id: number
    full_name: string
    description: string | null
    stargazers_count: number
    forks_count: number
    owner: { login: string; avatar_url: string }
  }>
}

// --- Core fetch + error mapping -------------------------------------------

function mapGitHubError(err: unknown): never {
  const status =
    (err as { response?: { status?: number } })?.response?.status ??
    (err as { statusCode?: number })?.statusCode

  if (status === 404) {
    throw createError({ statusCode: 404, message: 'Repository or resource not found.' })
  }
  if (status === 403 || status === 429) {
    throw createError({
      statusCode: 429,
      statusMessage: 'GitHub Rate Limited',
      message: 'GitHub API rate limit reached. Try again later.',
    })
  }
  throw createError({ statusCode: 502, message: 'GitHub API request failed.' })
}

/**
 * Typed GitHub GET. `path` is relative to https://api.github.com.
 * Throws mapped H3 errors (see module doc).
 */
export async function ghFetch<T>(
  path: string,
  query?: Record<string, string | number>
): Promise<T> {
  try {
    return await $fetch<T>(`${API_BASE}${path}`, {
      headers: buildHeaders(),
      query,
    })
  } catch (err) {
    mapGitHubError(err)
  }
}

// --- Typed endpoint helpers -----------------------------------------------

export const github = {
  getRepo: (owner: string, repo: string) =>
    ghFetch<GhRepo>(`/repos/${owner}/${repo}`),

  getLanguages: (owner: string, repo: string) =>
    ghFetch<GhLanguages>(`/repos/${owner}/${repo}/languages`),

  getContributors: (owner: string, repo: string, perPage: number) =>
    ghFetch<GhContributor[]>(`/repos/${owner}/${repo}/contributors`, {
      per_page: perPage,
    }),

  listCommits: (
    owner: string,
    repo: string,
    opts: { perPage?: number; sha?: string } = {}
  ) =>
    ghFetch<GhCommitListItem[]>(`/repos/${owner}/${repo}/commits`, {
      ...(opts.perPage ? { per_page: opts.perPage } : {}),
      ...(opts.sha ? { sha: opts.sha } : {}),
    }),

  getCommit: (owner: string, repo: string, sha: string) =>
    ghFetch<GhCommitDetail>(`/repos/${owner}/${repo}/commits/${sha}`),

  getBranches: (owner: string, repo: string, perPage: number) =>
    ghFetch<GhBranch[]>(`/repos/${owner}/${repo}/branches`, { per_page: perPage }),

  getReleases: (owner: string, repo: string, perPage: number) =>
    ghFetch<GhRelease[]>(`/repos/${owner}/${repo}/releases`, { per_page: perPage }),

  listTags: (owner: string, repo: string, perPage: number) =>
    ghFetch<GhTag[]>(`/repos/${owner}/${repo}/tags`, { per_page: perPage }),

  getTree: (owner: string, repo: string, sha: string) =>
    ghFetch<GhTreeResponse>(`/repos/${owner}/${repo}/git/trees/${sha}`, {
      recursive: '1',
    }),

  getTagRef: (owner: string, repo: string, tag: string) =>
    ghFetch<GhRef>(`/repos/${owner}/${repo}/git/ref/tags/${tag}`),

  getAnnotatedTag: (owner: string, repo: string, sha: string) =>
    ghFetch<GhAnnotatedTag>(`/repos/${owner}/${repo}/git/tags/${sha}`),

  search: (q: string, perPage: number) =>
    ghFetch<GhSearchResponse>('/search/repositories', {
      q,
      per_page: perPage,
      sort: 'stars',
      order: 'desc',
    }),
}
