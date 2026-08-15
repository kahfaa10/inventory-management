import { readBody } from 'h3'
import { createRack } from '../../services/master.service'
import { created, requireMasterWrite } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  const actor = await requireMasterWrite(event)
  return created(event, await createRack(actor.id, await readBody(event)))
})
