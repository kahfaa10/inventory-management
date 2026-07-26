import { describe, expect, it, vi } from 'vitest'
import { loadAllActiveMasterOptions } from '../../app/composables/useActiveMasterOptions'

describe('active master option loading', () => {
  it('loads every active page instead of silently stopping at 100 records', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({ id: String(index + 1) })),
        page: 1,
        pageSize: 100,
        total: 205,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({ id: String(index + 101) })),
        page: 2,
        pageSize: 100,
        total: 205,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 5 }, (_, index) => ({ id: String(index + 201) })),
        page: 3,
        pageSize: 100,
        total: 205,
      })

    const records = await loadAllActiveMasterOptions('/api/models', fetcher)

    expect(records).toHaveLength(205)
    expect(records.at(-1)).toEqual({ id: '205' })
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/models', {
      query: { isActive: true, page: 3, pageSize: 100 },
    })
  })

  it('fails clearly when an incomplete endpoint stops returning records', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 1,
    })

    await expect(loadAllActiveMasterOptions('/api/devices', fetcher)).rejects.toThrow(
      'stopped before all records were loaded',
    )
  })
})
