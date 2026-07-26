import { z } from 'zod'
import { TRANSACTION_STATUSES } from '../enums/inventory'
import { VALIDATION_MESSAGES } from '../validation/messages'
import { idSchema, listQuerySchema, positiveQuantitySchema } from './common'

const releaseDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Release Date must be a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Release Date must be a valid date.')

const nullableTextSchema = (maximum: number, label: string) =>
  z
    .string()
    .trim()
    .max(maximum, `${label} must be at most ${maximum} characters.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))

export const stockReleaseDetailSchema = z.strictObject({
  deviceDetailId: idSchema,
  sourceRackId: idSchema,
  releasedQuantity: positiveQuantitySchema,
  notes: nullableTextSchema(10_000, 'Notes'),
})

export const stockReleaseCreateSchema = z
  .strictObject({
    releaseDate: releaseDateSchema,
    engineerName: z
      .string()
      .trim()
      .min(1, VALIDATION_MESSAGES.required('Engineer Name'))
      .max(200, 'Engineer Name must be at most 200 characters.'),
    customerId: idSchema,
    modelId: idSchema.nullable().optional().default(null),
    serviceTagId: idSchema.nullable().optional().default(null),
    referenceNumber: nullableTextSchema(200, 'Reference Number'),
    notes: nullableTextSchema(10_000, 'Notes'),
    details: z
      .array(stockReleaseDetailSchema)
      .min(1, 'At least one transaction detail is required.'),
  })
  .superRefine((value, context) => {
    if (value.serviceTagId && !value.modelId) {
      context.addIssue({
        code: 'custom',
        message: 'Model is required when Service Tag is selected.',
        path: ['modelId'],
      })
    }
  })

export const stockReleaseUpdateSchema = stockReleaseCreateSchema

export const stockReleaseListQuerySchema = listQuerySchema
  .omit({ isActive: true })
  .extend({
    status: z.enum(TRANSACTION_STATUSES).optional(),
    customerId: idSchema.optional(),
    modelId: idSchema.optional(),
    serviceTagId: idSchema.optional(),
    dateFrom: releaseDateSchema.optional(),
    dateTo: releaseDateSchema.optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'Date From must not be after Date To.',
    path: ['dateTo'],
  })

export type StockReleaseCreateInput = z.input<typeof stockReleaseCreateSchema>
export type StockReleaseCreate = z.output<typeof stockReleaseCreateSchema>
export type StockReleaseUpdateInput = z.input<typeof stockReleaseUpdateSchema>
export type StockReleaseListQueryInput = z.input<typeof stockReleaseListQuerySchema>
export type StockReleaseListQuery = z.output<typeof stockReleaseListQuerySchema>
