import { describe, expect, it, vi } from 'vitest'
import { getStockBalances, stockBalanceKey } from '../../server/services/stock.service'

describe('bulk stock balances', () => {
  it('deduplicates keys and loads every balance with one grouped query', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      {
        deviceDetailId: BigInt(1),
        rackId: BigInt(2),
        _sum: { quantityIn: 10, quantityOut: 3 },
      },
      {
        deviceDetailId: BigInt(3),
        rackId: BigInt(4),
        _sum: { quantityIn: 2, quantityOut: 0 },
      },
    ])
    const client = { stockMovement: { groupBy } }

    const balances = await getStockBalances(client as never, [
      { deviceDetailId: BigInt(1), rackId: BigInt(2) },
      { deviceDetailId: BigInt(1), rackId: BigInt(2) },
      { deviceDetailId: BigInt(3), rackId: BigInt(4) },
      { deviceDetailId: BigInt(5), rackId: BigInt(6) },
    ])

    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith({
      by: ['deviceDetailId', 'rackId'],
      where: {
        OR: [
          { deviceDetailId: BigInt(1), rackId: BigInt(2) },
          { deviceDetailId: BigInt(3), rackId: BigInt(4) },
          { deviceDetailId: BigInt(5), rackId: BigInt(6) },
        ],
      },
      _sum: { quantityIn: true, quantityOut: true },
    })
    expect(balances).toEqual(
      new Map([
        [stockBalanceKey(BigInt(1), BigInt(2)), 7],
        [stockBalanceKey(BigInt(3), BigInt(4)), 2],
        [stockBalanceKey(BigInt(5), BigInt(6)), 0],
      ]),
    )
  })

  it('does not query for an empty key set', async () => {
    const groupBy = vi.fn()
    await expect(getStockBalances({ stockMovement: { groupBy } } as never, [])).resolves.toEqual(
      new Map(),
    )
    expect(groupBy).not.toHaveBeenCalled()
  })
})
