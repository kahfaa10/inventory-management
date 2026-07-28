import { getQuery } from 'h3'
import { getStockOutReport } from '../../services/report.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockOutReport(getQuery(event))
})
