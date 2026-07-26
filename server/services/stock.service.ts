import type { Prisma } from '../../generated/prisma/client'

type StockBalanceClient = Pick<Prisma.TransactionClient, 'stockMovement'>

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
