import { getQuery } from 'h3'
import { z } from 'zod'
import { idSchema } from '../../../shared/schemas/common'
import type { StockBalanceResponse } from '../../../shared/types/stock'
import { getAvailableStockBalance } from '../../services/stock.service'
import { requireAppUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { parseQuery } from '../../utils/validation'

const stockBalanceQuerySchema = z.strictObject({
  deviceDetailId: idSchema,
  rackId: idSchema,
})

export default defineEventHandler(async (event): Promise<StockBalanceResponse> => {
  await requireAppUser(event)
  const query = parseQuery(stockBalanceQuerySchema, getQuery(event))
  const deviceDetailId = BigInt(query.deviceDetailId)
  const rackId = BigInt(query.rackId)

  return {
    deviceDetailId: query.deviceDetailId,
    rackId: query.rackId,
    balance: await getAvailableStockBalance(prisma, deviceDetailId, rackId),
  }
})
