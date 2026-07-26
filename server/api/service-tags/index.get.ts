import { getQuery } from 'h3'
import { listServiceTags } from '../../services/master.service'
import { requireMasterRead } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireMasterRead(event)
  return listServiceTags(getQuery(event))
})
