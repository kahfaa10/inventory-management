import { readBody } from 'h3'
import { createStockRelease } from '../../services/stock-release.service'
import { requireAppUser } from '../../utils/auth'
import { created } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return created(event, await createStockRelease(actor.id, await readBody(event)))
})
