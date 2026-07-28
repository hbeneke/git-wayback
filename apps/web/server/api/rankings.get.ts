import { getRanking } from '../services/rankings'

/** Home page summary: the top of each period in one round trip. */
const SUMMARY_LIMIT = 10

export default defineEventHandler(async () => {
  const [popular, popularMonth, popularWeek] = await Promise.all([
    getRanking('popular', { limit: SUMMARY_LIMIT }),
    getRanking('month', { limit: SUMMARY_LIMIT }),
    getRanking('week', { limit: SUMMARY_LIMIT }),
  ])

  return { popular, popularMonth, popularWeek }
})
