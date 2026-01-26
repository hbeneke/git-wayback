export default defineEventHandler(async (event) => {
  const { owner, repo } = validateRepoParams(event)
  const headers = getGitHubHeaders()

  // Fetch all data in parallel
  const [
    repoData,
    languages,
    contributors,
    commits,
    branches,
    releases,
  ] = await Promise.all([
    // Basic repo info
    $fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),

    // Languages breakdown
    $fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers })
      .catch(() => ({})),

    // Top contributors
    $fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`, {
      headers,
      query: { per_page: 10 },
    }).catch(() => []),

    // Recent commits
    $fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, {
      headers,
      query: { per_page: 30 },
    }).catch(() => []),

    // Branches
    $fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers,
      query: { per_page: 100 },
    }).catch(() => []),

    // Releases
    $fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      headers,
      query: { per_page: 10 },
    }).catch(() => []),
  ])

  // Calculate language percentages
  const totalBytes = Object.values(languages as Record<string, number>).reduce((a, b) => a + b, 0)
  const languagePercentages = Object.entries(languages as Record<string, number>).map(([name, bytes]) => ({
    name,
    bytes,
    percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
  })).sort((a, b) => b.percentage - a.percentage)

  // Calculate commit activity by day of week and hour
  const commitActivity = {
    byDayOfWeek: [0, 0, 0, 0, 0, 0, 0], // Sun-Sat
    byHour: Array(24).fill(0),
    byMonth: {} as Record<string, number>,
  }

  const commitList = commits as Array<{
    sha: string
    commit: {
      message: string
      author: { name: string; email: string; date: string }
      committer: { name: string; date: string }
    }
    author?: { login: string; avatar_url: string }
  }>

  for (const commit of commitList) {
    const date = new Date(commit.commit.author.date)
    commitActivity.byDayOfWeek[date.getDay()]++
    commitActivity.byHour[date.getHours()]++

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    commitActivity.byMonth[monthKey] = (commitActivity.byMonth[monthKey] || 0) + 1
  }

  // Format contributors
  const contributorList = (contributors as Array<{
    login: string
    avatar_url: string
    contributions: number
    html_url: string
  }>).map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    contributions: c.contributions,
    url: c.html_url,
  }))

  // Format recent commits
  const recentCommits = commitList.slice(0, 15).map((c) => ({
    sha: c.sha,
    shortSha: c.sha.substring(0, 7),
    message: c.commit.message.split('\n')[0],
    authorName: c.commit.author.name,
    authorLogin: c.author?.login,
    authorAvatar: c.author?.avatar_url,
    date: c.commit.author.date,
  }))

  // Format releases
  const releaseList = (releases as Array<{
    tag_name: string
    name: string
    published_at: string
    html_url: string
    prerelease: boolean
  }>).map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    publishedAt: r.published_at,
    url: r.html_url,
    prerelease: r.prerelease,
  }))

  // Basic repo info
  const r = repoData as {
    id: number
    name: string
    full_name: string
    description: string
    html_url: string
    homepage: string
    stargazers_count: number
    watchers_count: number
    forks_count: number
    open_issues_count: number
    size: number
    default_branch: string
    created_at: string
    updated_at: string
    pushed_at: string
    license?: { name: string; spdx_id: string }
    topics: string[]
    visibility: string
    archived: boolean
    disabled: boolean
  }

  return {
    // Basic info
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    url: r.html_url,
    homepage: r.homepage,

    // Stats
    stars: r.stargazers_count,
    watchers: r.watchers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    size: r.size, // in KB

    // Meta
    defaultBranch: r.default_branch,
    license: r.license?.name || null,
    topics: r.topics || [],
    visibility: r.visibility,
    archived: r.archived,

    // Dates
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,

    // Computed data
    languages: languagePercentages,
    contributors: contributorList,
    recentCommits,
    branches: (branches as Array<{ name: string }>).map((b) => b.name),
    branchCount: (branches as Array<unknown>).length,
    releases: releaseList,
    commitActivity,
  }
})
