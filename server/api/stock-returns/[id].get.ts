import { getStockReturn } from '../../services/stock-return.service'
import { requireAppUser } from '../../utils/auth'
import { validatedMasterId } from '../../utils/master-route'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  return getStockReturn(validatedMasterId(event))
})
