type GitHubHeaders = Record<string, string>

function getHeaders(): GitHubHeaders {
  const headers: GitHubHeaders = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'git-wayback',
  }

  const token = process.env.GITHUB_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

interface GitHubTag {
  name: string
  commit: {
    sha: string
    url: string
  }
}

interface GitHubCommitDetail {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
}

export interface TagPoint {
  tag: string
  sha: string
  shortSha: string
  message: string
  date: string
  index: number
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRouterParams(event)
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)

  const headers = getHeaders()

  // Get tags for the timeline
  const tags = await $fetch<GitHubTag[]>(
    `https://api.github.com/repos/${owner}/${repo}/tags`,
    {
      headers,
      query: { per_page: limit },
    }
  )

  if (tags.length === 0) {
    return {
      tags: [],
      totalTags: 0,
    }
  }

  // Get commit details for each tag (in parallel, max 10 at a time)
  const tagDetails = await Promise.all(
    tags.slice(0, limit).map(async (tag) => {
      try {
        const commit = await $fetch<GitHubCommitDetail>(
          `https://api.github.com/repos/${owner}/${repo}/commits/${tag.commit.sha}`,
          { headers }
        )
        return {
          tag: tag.name,
          sha: tag.commit.sha,
          shortSha: tag.commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0],
          date: commit.commit.author.date,
        }
      } catch {
        return {
          tag: tag.name,
          sha: tag.commit.sha,
          shortSha: tag.commit.sha.substring(0, 7),
          message: '',
          date: '',
        }
      }
    })
  )

  // Sort by date (oldest first) and add index
  const sorted = tagDetails
    .filter((t) => t.date) // Remove tags without date
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t, i) => ({ ...t, index: i }))

  return {
    tags: sorted,
    totalTags: sorted.length,
  }
})
