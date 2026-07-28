import { getQuery } from 'h3'
import { getStockInReport } from '../../services/report.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockInReport(getQuery(event))
})
