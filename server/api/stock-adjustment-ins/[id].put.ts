import { readBody } from 'h3'
import { updateStockAdjustmentIn } from '../../services/stock-adjustment-in.service'
import { requireAppUser } from '../../utils/auth'
import { validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return updateStockAdjustmentIn(actor.id, validatedMasterId(event), await readBody(event))
})
