import { readBody } from 'h3'
import { updateStockReturn } from '../../services/stock-return.service'
import { requireAppUser } from '../../utils/auth'
import { validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return updateStockReturn(actor.id, validatedMasterId(event), await readBody(event))
})
