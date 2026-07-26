import { getQuery } from 'h3'
import { listStockReleases } from '../../services/stock-release.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return listStockReleases(getQuery(event))
})
