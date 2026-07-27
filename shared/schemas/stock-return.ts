import { z } from 'zod'
import { TRANSACTION_STATUSES } from '../enums/inventory'
import { VALIDATION_MESSAGES } from '../validation/messages'
import { idSchema, listQuerySchema, positiveQuantitySchema } from './common'

const returnDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Return Date must be a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Return Date must be a valid date.')

const requiredIdSchema = (label: string) =>
  z
    .any()
    .refine(
      (value) => value !== undefined && value !== null && value !== '',
      VALIDATION_MESSAGES.required(label),
    )
    .pipe(idSchema)

const nullableTextSchema = (maximum: number, label: string) =>
  z
    .string()
    .trim()
    .max(maximum, `${label} must be at most ${maximum} characters.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))

export const stockReturnDetailSchema = z.strictObject({
  stockReleaseDetailId: requiredIdSchema('Released Item'),
  destinationRackId: requiredIdSchema('Rack'),
  returnQuantity: positiveQuantitySchema,
  notes: nullableTextSchema(10_000, 'Notes'),
})

export const stockReturnCreateSchema = z.strictObject({
  returnDate: returnDateSchema,
  stockReleaseId: requiredIdSchema('Original Stock Release'),
  notes: nullableTextSchema(10_000, 'Notes'),
  details: z.array(stockReturnDetailSchema).min(1, 'At least one transaction detail is required.'),
})

export const stockReturnUpdateSchema = stockReturnCreateSchema

export const stockReturnListQuerySchema = listQuerySchema
  .omit({ isActive: true })
  .extend({
    status: z.enum(TRANSACTION_STATUSES).optional(),
    stockReleaseId: idSchema.optional(),
    customerId: idSchema.optional(),
    dateFrom: returnDateSchema.optional(),
    dateTo: returnDateSchema.optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'Date From must not be after Date To.',
    path: ['dateTo'],
  })

export const eligibleStockReleaseListQuerySchema = listQuerySchema.omit({ isActive: true }).extend({
  customerId: idSchema.optional(),
})

export type StockReturnCreateInput = z.input<typeof stockReturnCreateSchema>
export type StockReturnCreate = z.output<typeof stockReturnCreateSchema>
export type StockReturnUpdateInput = z.input<typeof stockReturnUpdateSchema>
export type StockReturnListQueryInput = z.input<typeof stockReturnListQuerySchema>
export type StockReturnListQuery = z.output<typeof stockReturnListQuerySchema>
export type EligibleStockReleaseListQueryInput = z.input<typeof eligibleStockReleaseListQuerySchema>
