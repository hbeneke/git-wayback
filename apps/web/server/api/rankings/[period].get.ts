import {
  getRanking,
  isRankingPeriod,
  normalizePaging,
  RANKING_PERIODS,
} from '../../services/rankings'

export default defineEventHandler(async (event) => {
  const period = getRouterParam(event, 'period')

  if (!isRankingPeriod(period)) {
    throw createError({
      statusCode: 400,
      message: `Invalid period. Use: ${RANKING_PERIODS.join(', ')}`,
    })
  }

  const query = getQuery(event)
  const paging = normalizePaging(query.limit, query.offset)

  return getRanking(period, paging)
})
