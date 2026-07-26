import { readBody } from 'h3'
import { createStockAdjustmentIn } from '../../services/stock-adjustment-in.service'
import { requireAppUser } from '../../utils/auth'
import { created } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return created(event, await createStockAdjustmentIn(actor.id, await readBody(event)))
})
