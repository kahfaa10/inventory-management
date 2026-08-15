import { readBody } from 'h3'
import { createStockReturn } from '../../services/stock-return.service'
import { requireAppUser } from '../../utils/auth'
import { created } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return created(event, await createStockReturn(actor.id, await readBody(event)))
})
