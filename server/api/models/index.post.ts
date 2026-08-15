import { readBody } from 'h3'
import { createModel } from '../../services/master.service'
import { created, requireMasterWrite } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireMasterWrite(event)
  return created(event, await createModel(actor.id, await readBody(event)))
})
