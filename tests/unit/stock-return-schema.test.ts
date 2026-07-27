import { describe, expect, it } from 'vitest'
import {
  stockReturnCreateSchema,
  stockReturnListQuerySchema,
} from '../../shared/schemas/stock-return'
import { POSTGRES_SIGNED_INTEGER_MAX } from '../../shared/schemas/common'

const validBody = {
  returnDate: '2026-07-20',
  stockReleaseId: '1',
  notes: null,
  details: [
    {
      stockReleaseDetailId: '2',
      destinationRackId: '3',
      returnQuantity: 1,
      notes: null,
    },
  ],
}

describe('stock return schemas', () => {
  it('accepts strict, positive return details at PostgreSQL Int boundaries', () => {
    expect(
      stockReturnCreateSchema.parse({
        ...validBody,
        details: [{ ...validBody.details[0], returnQuantity: POSTGRES_SIGNED_INTEGER_MAX }],
      }),
    ).toMatchObject({
      stockReleaseId: '1',
      details: [{ returnQuantity: POSTGRES_SIGNED_INTEGER_MAX }],
    })
  })

  it.each([0, -1, 1.5, POSTGRES_SIGNED_INTEGER_MAX + 1])(
    'rejects invalid return quantity %s',
    (returnQuantity) => {
      expect(() =>
        stockReturnCreateSchema.parse({
          ...validBody,
          details: [{ ...validBody.details[0], returnQuantity }],
        }),
      ).toThrow()
    },
  )

  it('requires an original release and at least one detail', () => {
    expect(() =>
      stockReturnCreateSchema.parse({ ...validBody, stockReleaseId: undefined }),
    ).toThrow('Original Stock Release is required.')
    expect(() => stockReturnCreateSchema.parse({ ...validBody, details: [] })).toThrow(
      'At least one transaction detail is required.',
    )
  })

  it('rejects unknown body and query properties', () => {
    expect(() => stockReturnCreateSchema.parse({ ...validBody, status: 'COMPLETED' })).toThrow()
    expect(() => stockReturnListQuerySchema.parse({ unexpected: true })).toThrow()
  })

  it('validates date ranges', () => {
    expect(() =>
      stockReturnListQuerySchema.parse({ dateFrom: '2026-07-21', dateTo: '2026-07-20' }),
    ).toThrow('Date From must not be after Date To.')
  })
})
