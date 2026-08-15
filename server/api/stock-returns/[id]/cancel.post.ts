import { cancelStockReturn } from '../../../services/stock-return.service'
import { requireRole } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])
  return cancelStockReturn(validatedMasterId(event), actor.id)
})
