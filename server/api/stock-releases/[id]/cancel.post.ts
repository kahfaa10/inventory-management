import { cancelStockRelease } from '../../../services/stock-release.service'
import { requireRole } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])
  return cancelStockRelease(validatedMasterId(event), actor.id)
})
