import { getQuery } from 'h3'
import { listModels } from '../../services/master.service'
import { requireMasterRead } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return listModels(getQuery(event))
})
