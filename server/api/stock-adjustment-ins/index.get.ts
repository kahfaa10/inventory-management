import { getQuery } from 'h3'
import { listStockAdjustmentIns } from '../../services/stock-adjustment-in.service'
import { requireAppUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return listStockAdjustmentIns(getQuery(event))
})
