import { getStockAdjustmentIn } from '../../services/stock-adjustment-in.service'
import { requireAppUser } from '../../utils/auth'
import { validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockAdjustmentIn(validatedMasterId(event))
})
