import { completeStockReturn } from '../../../services/stock-return.service'
import { requireAppUser } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return completeStockReturn(validatedMasterId(event), actor.id)
})
