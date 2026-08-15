import { getQuery } from 'h3'
import { listEligibleStockReleases } from '../../services/stock-return.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return listEligibleStockReleases(getQuery(event))
})
