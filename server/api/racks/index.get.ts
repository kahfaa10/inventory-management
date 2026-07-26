import { getQuery } from 'h3'
import { listRacks } from '../../services/master.service'
import { requireMasterRead } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return listRacks(getQuery(event))
})
