import { cancelStockAdjustmentIn } from '../../../services/stock-adjustment-in.service'
import { requireRole } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])
  return cancelStockAdjustmentIn(validatedMasterId(event), actor.id)
})
