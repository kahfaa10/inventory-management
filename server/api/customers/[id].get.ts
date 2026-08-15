import { getCustomer } from '../../services/master.service'
import { requireMasterRead, validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return getCustomer(validatedMasterId(event))
})
