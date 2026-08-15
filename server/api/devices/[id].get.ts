import { getDevice } from '../../services/master.service'
import { requireMasterRead, validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return getDevice(validatedMasterId(event))
})
