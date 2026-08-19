import { DISPLAY, GITHUB_API } from '@git-wayback/shared'
import {
  type GhBranch,
  type GhCommitListItem,
  type GhContributor,
  type GhLanguages,
  type GhRelease,
  github,
} from '../utils/github-client'

export interface LanguageShare {
  name: string
  bytes: number
  percentage: number
}

export interface CommitActivity {
  byDayOfWeek: number[]
  byHour: number[]
  /** How many commits this was computed from — it is not the repo total. */
  sampleSize: number
}

/**
 * Language byte counts as percentages, largest first.
 */
export function toLanguageShares(languages: GhLanguages): LanguageShare[] {
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0)

  return Object.entries(languages)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

/**
 * Buckets commit timestamps by weekday and hour.
 *
 * Hours are read in UTC rather than the server's local zone, which on Vercel
 * happened to be UTC anyway but made the result depend on where it ran. The
 * byMonth bucket that used to be here was serialized on every response and
 * never read by any component.
 */
export function toCommitActivity(commits: GhCommitListItem[]): CommitActivity {
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0]
  const byHour = Array(24).fill(0) as number[]

  for (const commit of commits) {
    const date = new Date(commit.commit.author.date)
    byDayOfWeek[date.getUTCDay()]++
    byHour[date.getUTCHours()]++
  }

  return { byDayOfWeek, byHour, sampleSize: commits.length }
}

/**
 * Everything the repository page renders, in one call.
 *
 * Only the repo itself is required — its failure must surface as 404/429/502.
 * Every sub-resource degrades to an empty value instead of failing the page,
 * and the fallbacks are typed so callers do not need casts.
 */
export async function getRepoOverview(owner: string, repo: string) {
  const [repoData, languages, contributors, commits, branches, releases] = await Promise.all([
    github.getRepo(owner, repo),
    github.getLanguages(owner, repo).catch((): GhLanguages => ({})),
    github
      .getContributors(owner, repo, GITHUB_API.CONTRIBUTORS_PER_PAGE)
      .catch((): GhContributor[] => []),
    github
      .listCommits(owner, repo, { perPage: GITHUB_API.COMMITS_PER_PAGE })
      .catch((): GhCommitListItem[] => []),
    github.getBranches(owner, repo, GITHUB_API.BRANCHES_PER_PAGE).catch((): GhBranch[] => []),
    github.getReleases(owner, repo, GITHUB_API.RELEASES_PER_PAGE).catch((): GhRelease[] => []),
  ])

  return {
    id: repoData.id,
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description,
    url: repoData.html_url,
    homepage: repoData.homepage,

    stars: repoData.stargazers_count,
    watchers: repoData.watchers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    size: repoData.size, // in KB

    defaultBranch: repoData.default_branch,
    license: repoData.license?.name || null,
    topics: repoData.topics || [],
    visibility: repoData.visibility,
    archived: repoData.archived,

    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    pushedAt: repoData.pushed_at,

    languages: toLanguageShares(languages),

    contributors: contributors.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
      url: c.html_url,
    })),

    recentCommits: commits.slice(0, DISPLAY.RECENT_COMMITS).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      // Rest of the message after the subject line.
      body: c.commit.message.split('\n').slice(1).join('\n').trim(),
      authorName: c.commit.author.name,
      authorLogin: c.author?.login,
      authorAvatar: c.author?.avatar_url,
      date: c.commit.author.date,
    })),

    branches: branches.map((b) => b.name),
    branchCount: branches.length,

    releases: releases.map((r) => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      publishedAt: r.published_at,
      url: r.html_url,
      prerelease: r.prerelease,
    })),

    commitActivity: toCommitActivity(commits),
  }
}
