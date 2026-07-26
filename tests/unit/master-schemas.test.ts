import { describe, expect, it } from 'vitest'
import {
  customerCreateSchema,
  deviceCreateSchema,
  deviceDetailCreateSchema,
  deviceDetailUpdateSchema,
  modelCreateSchema,
  rackCreateSchema,
  serviceTagCreateSchema,
} from '../../shared/schemas/masters'
import { serializeBigInts } from '../../server/utils/dto'
import { parseBody } from '../../server/utils/validation'

describe('master validation schemas', () => {
  it.each(['', '   '])('rejects blank model name %j', (modelName) => {
    expect(modelCreateSchema.safeParse({ modelName }).success).toBe(false)
  })

  it('trims master identifiers and nullable text', () => {
    expect(
      serviceTagCreateSchema.parse({
        modelId: '12',
        customerId: null,
        serviceTag: '  ABC-123  ',
        description: '  Customer server  ',
      }),
    ).toEqual({
      modelId: '12',
      customerId: null,
      serviceTag: 'ABC-123',
      description: 'Customer server',
      isActive: true,
    })
  })

  it.each([
    ['device name', deviceCreateSchema, { deviceName: '   ' }],
    ['customer name', customerCreateSchema, { customerName: '' }],
    ['rack code', rackCreateSchema, { rackCode: '', rackName: 'Rack A' }],
    ['rack name', rackCreateSchema, { rackCode: 'A', rackName: '  ' }],
  ])('rejects a blank %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })

  it('requires Device Detail Part Number and Specification', () => {
    const result = deviceDetailCreateSchema.safeParse({
      deviceId: '1',
      partNumber: ' ',
      specification: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        partNumber: ['Part Number is required.'],
        specification: ['Specification is required.'],
      })
    }
  })

  it('normalizes an empty nullable DP/N to null', () => {
    expect(
      deviceDetailCreateSchema.parse({
        deviceId: '1',
        partNumber: ' PN-1 ',
        dpn: '   ',
        specification: '  600 GB SAS ',
      }),
    ).toMatchObject({
      deviceId: '1',
      partNumber: 'PN-1',
      dpn: null,
      specification: '600 GB SAS',
      isActive: true,
    })
  })

  it('does not clear DP/N when an unrelated Device Detail field is updated', () => {
    expect(deviceDetailUpdateSchema.parse({ description: 'Updated' })).toEqual({
      description: 'Updated',
    })
  })

  it('returns structured field errors from shared request parsing', () => {
    expect(() => parseBody(rackCreateSchema, { rackCode: '', rackName: '' })).toThrowError(
      expect.objectContaining({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          rackCode: ['Rack Code is required.'],
          rackName: ['Rack Name is required.'],
        },
      }),
    )
  })

  it('serializes nested BigInts and dates without losing JSON safety', () => {
    const serialized = serializeBigInts({
      id: 42n,
      createdAt: new Date('2026-07-19T10:00:00.000Z'),
      children: [{ id: 43n }],
    })

    expect(serialized).toEqual({
      id: '42',
      createdAt: '2026-07-19T10:00:00.000Z',
      children: [{ id: '43' }],
    })
    expect(() => JSON.stringify(serialized)).not.toThrow()
  })
})
