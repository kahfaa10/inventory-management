import { readBody } from 'h3'
import { updateStockRelease } from '../../services/stock-release.service'
import { requireAppUser } from '../../utils/auth'
import { validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return updateStockRelease(actor.id, validatedMasterId(event), await readBody(event))
})
