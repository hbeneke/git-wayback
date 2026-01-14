export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = query.q as string

  if (!q || q.length < 2) {
    return { items: [], total_count: 0 }
  }

  const response = await $fetch<{
    total_count: number
    items: Array<{
      id: number
      full_name: string
      description: string | null
      stargazers_count: number
      forks_count: number
      owner: {
        login: string
        avatar_url: string
      }
    }>
  }>('https://api.github.com/search/repositories', {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'git-wayback',
    },
    query: {
      q,
      per_page: 10,
      sort: 'stars',
      order: 'desc',
    },
  })

  return {
    total_count: response.total_count,
    items: response.items.map((item) => ({
      id: item.id,
      fullName: item.full_name,
      description: item.description,
      stars: item.stargazers_count,
      forks: item.forks_count,
      owner: {
        login: item.owner.login,
        avatar: item.owner.avatar_url,
      },
    })),
  }
})
