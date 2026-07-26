import { MovementPurpose, type Prisma, type StockMovement } from '../../generated/prisma/client'
import type { StockKey } from '../../shared/types/stock'
import { ApiError } from '../utils/api-error'
import { lockStockKeys } from '../utils/stock-lock'
import { getStockBalance } from './stock.service'

function cancellationStockError(): ApiError {
  return new ApiError(
    409,
    'INSUFFICIENT_STOCK_FOR_CANCELLATION',
    'Cancellation would make stock negative.',
  )
}

export async function reverseInboundStockMovements(
  tx: Prisma.TransactionClient,
  originals: readonly StockMovement[],
  actorId: bigint,
): Promise<void> {
  const reversalsByStockKey = new Map<string, { key: StockKey; quantity: number }>()

  for (const original of originals) {
    if (
      original.movementPurpose !== MovementPurpose.ORIGINAL ||
      original.quantityIn <= 0 ||
      original.quantityOut !== 0
    ) {
      throw new ApiError(409, 'INVALID_CANCELLATION_SOURCE', 'Movement cannot be reversed.')
    }
    const key = `${original.deviceDetailId}:${original.rackId}`
    const aggregate = reversalsByStockKey.get(key)
    if (aggregate) {
      aggregate.quantity += original.quantityIn
    } else {
      reversalsByStockKey.set(key, {
        key: {
          deviceDetailId: original.deviceDetailId,
          rackId: original.rackId,
        },
        quantity: original.quantityIn,
      })
    }
  }

  const aggregates = [...reversalsByStockKey.values()]
  await lockStockKeys(
    tx,
    aggregates.map(({ key }) => key),
  )

  for (const { key, quantity } of aggregates) {
    if ((await getStockBalance(tx, key.deviceDetailId, key.rackId)) < quantity) {
      throw cancellationStockError()
    }
  }

  await tx.stockMovement.createMany({
    data: originals.map((original) => ({
      deviceDetailId: original.deviceDetailId,
      rackId: original.rackId,
      customerId: original.customerId,
      transactionType: original.transactionType,
      transactionId: original.transactionId,
      transactionDetailId: original.transactionDetailId,
      transactionNumber: original.transactionNumber,
      transactionDate: original.transactionDate,
      engineerName: original.engineerName,
      quantityIn: original.quantityOut,
      quantityOut: original.quantityIn,
      movementPurpose: MovementPurpose.CANCELLATION_REVERSAL,
      reversalOfId: original.id,
      createdById: actorId,
    })),
  })
}
