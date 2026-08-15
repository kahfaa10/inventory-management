import { getQuery } from 'h3'
import { listDevices } from '../../services/master.service'
import { requireMasterRead } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return listDevices(getQuery(event))
})
