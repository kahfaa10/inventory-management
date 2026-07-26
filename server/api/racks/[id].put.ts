import { readBody } from 'h3'
import { updateRack } from '../../services/master.service'
import { requireMasterWrite, validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireMasterWrite(event)
  return updateRack(actor.id, validatedMasterId(event), await readBody(event))
})
