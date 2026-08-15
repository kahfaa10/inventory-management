import { readBody } from 'h3'
import { updateServiceTag } from '../../services/master.service'
import { requireMasterWrite, validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireMasterWrite(event)
  return updateServiceTag(actor.id, validatedMasterId(event), await readBody(event))
})
