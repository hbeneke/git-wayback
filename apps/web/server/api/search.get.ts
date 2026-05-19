import { GITHUB_API, DISPLAY } from '@git-wayback/shared'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Return empty results for short/missing queries without error
  if (!query.q || typeof query.q !== 'string' || query.q.trim().length < 2) {
    return { items: [], total_count: 0 }
  }

  const searchTerm = query.q.trim().slice(0, DISPLAY.MAX_SEARCH_LENGTH)

  const response = await github.search(searchTerm, GITHUB_API.SEARCH_PER_PAGE)

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
