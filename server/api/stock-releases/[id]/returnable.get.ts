import { getStockReleaseReturnable } from '../../../services/stock-release.service'
import { requireAppUser } from '../../../utils/auth'
import { validatedMasterId } from '../../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockReleaseReturnable(validatedMasterId(event))
})
