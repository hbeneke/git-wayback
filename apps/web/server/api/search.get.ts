export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Return empty results for short/missing queries without error
  if (!query.q || typeof query.q !== 'string' || query.q.trim().length < 2) {
    return { items: [], total_count: 0 }
  }

  const searchTerm = query.q.trim().slice(0, 256)

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
    headers: getGitHubHeaders(),
    query: {
      q: searchTerm,
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
