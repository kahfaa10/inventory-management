import { completeStockRelease } from '../../../services/stock-release.service'
import { requireAppUser } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireAppUser(event)
  return completeStockRelease(validatedMasterId(event), actor.id)
})
