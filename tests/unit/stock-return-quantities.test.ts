import { describe, expect, it, vi } from 'vitest'
import { getReturnableQuantities } from '../../server/services/stock-return.service'

describe('Stock Return quantity snapshots', () => {
  it('uses one grouped Completed-return query for unique release details', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      {
        stockReleaseDetailId: 1n,
        _sum: { returnQuantity: 2 },
      },
    ])
    const client = {
      stockReturnDetail: { groupBy },
    } as unknown as Parameters<typeof getReturnableQuantities>[0]

    const quantities = await getReturnableQuantities(client, [
      { id: 1n, releasedQuantity: 5 },
      { id: 1n, releasedQuantity: 5 },
      { id: 2n, releasedQuantity: 3 },
    ])

    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith({
      by: ['stockReleaseDetailId'],
      where: {
        stockReleaseDetailId: { in: [1n, 2n] },
        stockReturn: { status: 'COMPLETED' },
      },
      _sum: { returnQuantity: true },
    })
    expect(quantities.get(1n)).toEqual({
      releasedQuantity: 5,
      completedReturnedQuantity: 2,
      remainingReturnableQuantity: 3,
    })
    expect(quantities.get(2n)).toEqual({
      releasedQuantity: 3,
      completedReturnedQuantity: 0,
      remainingReturnableQuantity: 3,
    })
  })

  it('does not query when no release details are requested', async () => {
    const groupBy = vi.fn()
    const client = {
      stockReturnDetail: { groupBy },
    } as unknown as Parameters<typeof getReturnableQuantities>[0]

    await expect(getReturnableQuantities(client, [])).resolves.toEqual(new Map())
    expect(groupBy).not.toHaveBeenCalled()
  })
})
