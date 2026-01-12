export default defineEventHandler(async (event) => {
  const { owner, repo } = getRouterParams(event)

  const response = await $fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'git-wayback',
    },
  })

  return response
})
