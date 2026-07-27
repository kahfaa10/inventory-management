import type { Prisma } from '../../generated/prisma/client'
import type { StockKey } from '../../shared/types/stock'
import { inactiveMasterError, notFoundError } from '../utils/prisma-errors'

type StockBalanceClient = Pick<Prisma.TransactionClient, 'stockMovement'>
type AvailableStockClient = Pick<
  Prisma.TransactionClient,
  'deviceDetail' | 'rack' | 'stockMovement'
>

export function stockBalanceKey(deviceDetailId: bigint, rackId: bigint): string {
  return `${deviceDetailId}:${rackId}`
}

export async function getStockBalances(
  client: StockBalanceClient,
  keys: readonly StockKey[],
): Promise<Map<string, number>> {
  const uniqueKeys = new Map<string, StockKey>()
  for (const key of keys) {
    uniqueKeys.set(stockBalanceKey(key.deviceDetailId, key.rackId), key)
  }
  if (uniqueKeys.size === 0) return new Map()

  const balances = new Map([...uniqueKeys.keys()].map((key) => [key, 0]))
  const rows = await client.stockMovement.groupBy({
    by: ['deviceDetailId', 'rackId'],
    where: {
      OR: [...uniqueKeys.values()].map(({ deviceDetailId, rackId }) => ({
        deviceDetailId,
        rackId,
      })),
    },
    _sum: {
      quantityIn: true,
      quantityOut: true,
    },
  })

  for (const row of rows) {
    balances.set(
      stockBalanceKey(row.deviceDetailId, row.rackId),
      (row._sum.quantityIn ?? 0) - (row._sum.quantityOut ?? 0),
    )
  }
  return balances
}

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
