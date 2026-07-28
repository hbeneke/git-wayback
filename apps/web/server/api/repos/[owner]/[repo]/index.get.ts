import { getRepoOverview } from '../../../../services/repo'

export default defineEventHandler(async (event) => {
  const { owner, repo } = validateRepoParams(event)

  return getRepoOverview(owner, repo)
})
