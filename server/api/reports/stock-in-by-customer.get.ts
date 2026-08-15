import { getQuery } from 'h3'
import { getStockInByCustomerReport } from '../../services/report.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockInByCustomerReport(getQuery(event))
})
