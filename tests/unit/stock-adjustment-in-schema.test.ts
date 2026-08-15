import { describe, expect, it } from 'vitest'
import {
  stockAdjustmentInCreateSchema,
  stockAdjustmentInListQuerySchema,
} from '../../shared/schemas/stock-adjustment-in'
import { POSTGRES_SIGNED_INTEGER_MAX } from '../../shared/schemas/common'

const validInput = {
  transactionDate: '2026-07-19',
  customerId: null,
  notes: '  initial stock  ',
  details: [
    {
      deviceDetailId: '1',
      destinationRackId: '2',
      quantity: 10,
      notes: '  first line  ',
    },
  ],
}

describe('stock adjustment in schemas', () => {
  it('accepts a strict valid draft and normalizes nullable text', () => {
    expect(stockAdjustmentInCreateSchema.parse(validInput)).toEqual({
      ...validInput,
      notes: 'initial stock',
      details: [{ ...validInput.details[0], notes: 'first line' }],
    })
  })

  it.each([0, -1, 1.5])('rejects invalid quantity %s', (quantity) => {
    const result = stockAdjustmentInCreateSchema.safeParse({
      ...validInput,
      details: [{ ...validInput.details[0], quantity }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts the PostgreSQL Int maximum and rejects the next integer', () => {
    expect(
      stockAdjustmentInCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], quantity: POSTGRES_SIGNED_INTEGER_MAX }],
      }).success,
    ).toBe(true)
    expect(
      stockAdjustmentInCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], quantity: POSTGRES_SIGNED_INTEGER_MAX + 1 }],
      }).success,
    ).toBe(false)
  })

  it('requires at least one detail and rejects mass-assignment fields', () => {
    expect(stockAdjustmentInCreateSchema.safeParse({ ...validInput, details: [] }).success).toBe(
      false,
    )
    expect(
      stockAdjustmentInCreateSchema.safeParse({ ...validInput, status: 'COMPLETED' }).success,
    ).toBe(false)
    expect(
      stockAdjustmentInCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], rackId: '99' }],
      }).success,
    ).toBe(false)
  })

  it('validates real calendar dates and coherent list date ranges', () => {
    expect(
      stockAdjustmentInCreateSchema.safeParse({
        ...validInput,
        transactionDate: '2026-02-30',
      }).success,
    ).toBe(false)
    expect(
      stockAdjustmentInListQuerySchema.safeParse({
        dateFrom: '2026-07-20',
        dateTo: '2026-07-19',
      }).success,
    ).toBe(false)
  })

  it('does not inherit the master-only isActive list filter', () => {
    expect(stockAdjustmentInListQuerySchema.safeParse({ isActive: true }).success).toBe(false)
  })
})
