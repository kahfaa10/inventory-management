import { describe, expect, it } from 'vitest'
import { APP_NAME, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../shared/constants/app'

describe('application constants', () => {
  it('uses bounded pagination defaults', () => {
    expect(APP_NAME).toBe('Mini Inventory')
    expect(DEFAULT_PAGE_SIZE).toBe(20)
    expect(MAX_PAGE_SIZE).toBe(100)
  })
})
