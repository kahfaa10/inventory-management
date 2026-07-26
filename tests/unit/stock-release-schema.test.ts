import { describe, expect, it } from 'vitest'
import { POSTGRES_SIGNED_INTEGER_MAX } from '../../shared/schemas/common'
import {
  stockReleaseCreateSchema,
  stockReleaseListQuerySchema,
} from '../../shared/schemas/stock-release'

const validInput = {
  releaseDate: '2026-07-19',
  engineerName: '  Engineer One  ',
  customerId: '1',
  modelId: null,
  serviceTagId: null,
  referenceNumber: '  INC-123  ',
  notes: '  customer visit  ',
  details: [
    {
      deviceDetailId: '2',
      sourceRackId: '3',
      releasedQuantity: 1,
      notes: '  line note  ',
    },
  ],
}

describe('stock release schemas', () => {
  it('accepts a strict valid draft and normalizes text', () => {
    expect(stockReleaseCreateSchema.parse(validInput)).toEqual({
      ...validInput,
      engineerName: 'Engineer One',
      referenceNumber: 'INC-123',
      notes: 'customer visit',
      details: [{ ...validInput.details[0], notes: 'line note' }],
    })
  })

  it.each(['', '   '])('requires a nonblank Engineer Name %j', (engineerName) => {
    expect(stockReleaseCreateSchema.safeParse({ ...validInput, engineerName }).success).toBe(false)
  })

  it('requires Customer', () => {
    const { customerId: _, ...withoutCustomer } = validInput
    expect(stockReleaseCreateSchema.safeParse(withoutCustomer).success).toBe(false)
  })

  it('requires Model when Service Tag is selected', () => {
    expect(
      stockReleaseCreateSchema.safeParse({
        ...validInput,
        modelId: null,
        serviceTagId: '4',
      }).success,
    ).toBe(false)
  })

  it.each([0, -1, 1.5])('rejects invalid released quantity %s', (releasedQuantity) => {
    expect(
      stockReleaseCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], releasedQuantity }],
      }).success,
    ).toBe(false)
  })

  it('accepts PostgreSQL Int maximum and rejects the next integer', () => {
    expect(
      stockReleaseCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], releasedQuantity: POSTGRES_SIGNED_INTEGER_MAX }],
      }).success,
    ).toBe(true)
    expect(
      stockReleaseCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], releasedQuantity: POSTGRES_SIGNED_INTEGER_MAX + 1 }],
      }).success,
    ).toBe(false)
  })

  it('requires one detail and rejects mass-assignment fields', () => {
    expect(stockReleaseCreateSchema.safeParse({ ...validInput, details: [] }).success).toBe(false)
    expect(stockReleaseCreateSchema.safeParse({ ...validInput, status: 'COMPLETED' }).success).toBe(
      false,
    )
    expect(
      stockReleaseCreateSchema.safeParse({
        ...validInput,
        details: [{ ...validInput.details[0], rackId: '99' }],
      }).success,
    ).toBe(false)
  })

  it('validates real calendar dates and strict list queries', () => {
    expect(
      stockReleaseCreateSchema.safeParse({ ...validInput, releaseDate: '2026-02-30' }).success,
    ).toBe(false)
    expect(
      stockReleaseListQuerySchema.safeParse({
        dateFrom: '2026-07-20',
        dateTo: '2026-07-19',
      }).success,
    ).toBe(false)
    expect(stockReleaseListQuerySchema.safeParse({ isActive: true }).success).toBe(false)
    expect(stockReleaseListQuerySchema.safeParse({ unexpected: true }).success).toBe(false)
  })
})
