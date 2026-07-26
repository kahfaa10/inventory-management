import type { Prisma } from '../../generated/prisma/client'
import { inactiveMasterError, notFoundError } from '../utils/prisma-errors'

type StockBalanceClient = Pick<Prisma.TransactionClient, 'stockMovement'>
type AvailableStockClient = Pick<
  Prisma.TransactionClient,
  'deviceDetail' | 'rack' | 'stockMovement'
>

export async function getStockBalance(
  client: StockBalanceClient,
  deviceDetailId: bigint,
  rackId: bigint,
): Promise<number> {
  const totals = await client.stockMovement.aggregate({
    where: {
      deviceDetailId,
      rackId,
    },
    _sum: {
      quantityIn: true,
      quantityOut: true,
    },
  })

  return (totals._sum.quantityIn ?? 0) - (totals._sum.quantityOut ?? 0)
}

export async function getAvailableStockBalance(
  client: AvailableStockClient,
  deviceDetailId: bigint,
  rackId: bigint,
): Promise<number> {
  const deviceDetail = await client.deviceDetail.findUnique({
    where: { id: deviceDetailId },
    select: {
      isActive: true,
      device: { select: { isActive: true } },
    },
  })
  if (!deviceDetail) throw notFoundError()
  if (!deviceDetail.isActive || !deviceDetail.device.isActive) throw inactiveMasterError()

  const rack = await client.rack.findUnique({
    where: { id: rackId },
    select: { isActive: true },
  })
  if (!rack) throw notFoundError()
  if (!rack.isActive) throw inactiveMasterError()

  return getStockBalance(client, deviceDetailId, rackId)
}
