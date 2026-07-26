import { z } from 'zod'
import { TRANSACTION_STATUSES } from '../enums/inventory'
import { VALIDATION_MESSAGES } from '../validation/messages'
import { idSchema, listQuerySchema } from './common'

const transactionDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Transaction Date must be a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Transaction Date must be a valid date.')

const nullableNotesSchema = z
  .string()
  .trim()
  .max(10_000, 'Notes must be at most 10000 characters.')
  .nullable()
  .optional()
  .transform((value) => (value === undefined || value === null || value === '' ? null : value))

export const stockAdjustmentInDetailSchema = z.strictObject({
  deviceDetailId: idSchema,
  destinationRackId: idSchema,
  quantity: z
    .number()
    .int(VALIDATION_MESSAGES.quantityPositive)
    .positive(VALIDATION_MESSAGES.quantityPositive),
  notes: nullableNotesSchema,
})

export const stockAdjustmentInCreateSchema = z.strictObject({
  transactionDate: transactionDateSchema,
  customerId: idSchema.nullable().optional().default(null),
  notes: nullableNotesSchema,
  details: z
    .array(stockAdjustmentInDetailSchema)
    .min(1, 'At least one transaction detail is required.'),
})

export const stockAdjustmentInUpdateSchema = stockAdjustmentInCreateSchema

export const stockAdjustmentInListQuerySchema = listQuerySchema
  .extend({
    status: z.enum(TRANSACTION_STATUSES).optional(),
    customerId: idSchema.optional(),
    dateFrom: transactionDateSchema.optional(),
    dateTo: transactionDateSchema.optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'Date From must not be after Date To.',
    path: ['dateTo'],
  })

export type StockAdjustmentInCreateInput = z.input<typeof stockAdjustmentInCreateSchema>
export type StockAdjustmentInCreate = z.output<typeof stockAdjustmentInCreateSchema>
export type StockAdjustmentInUpdateInput = z.input<typeof stockAdjustmentInUpdateSchema>
export type StockAdjustmentInListQueryInput = z.input<typeof stockAdjustmentInListQuerySchema>
export type StockAdjustmentInListQuery = z.output<typeof stockAdjustmentInListQuerySchema>
