import { describe, expect, it, vi } from 'vitest'
import { findEligibleStockReleasePage } from '../../server/repositories/stock-return.repository'

describe('Stock Return eligible-release paging', () => {
  it('hydrates only the release ids selected by the bounded database page', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ total: 7n }])
      .mockResolvedValueOnce([{ id: 19n }, { id: 17n }])
    const findMany = vi.fn().mockResolvedValue([{ id: 17n }, { id: 19n }])
    const client = {
      $queryRaw: queryRaw,
      stockRelease: { findMany },
    } as unknown as Parameters<typeof findEligibleStockReleasePage>[0]

    const result = await findEligibleStockReleasePage(client, {
      search: 'Engineer',
      customerId: 5n,
      skip: 2,
      take: 2,
    })

    expect(queryRaw).toHaveBeenCalledTimes(2)
    expect(findMany).toHaveBeenCalledOnce()
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [19n, 17n] } },
      include: expect.any(Object),
    })
    expect(result.total).toBe(7)
    expect(result.data.map(({ id }) => id)).toEqual([19n, 17n])

    const pageSql = queryRaw.mock.calls[1]![0] as {
      strings: readonly string[]
      values: readonly unknown[]
    }
    expect(pageSql.strings.join(' ')).toContain('LIMIT')
    expect(pageSql.strings.join(' ')).toContain('OFFSET')
    expect(pageSql.values.slice(-2)).toEqual([2, 2])
  })
})
