import { readBody } from 'h3'
import { updateModel } from '../../services/master.service'
import { requireMasterWrite, validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireMasterWrite(event)
  return updateModel(actor.id, validatedMasterId(event), await readBody(event))
})
