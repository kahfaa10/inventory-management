import { z } from 'zod'
import { TRANSACTION_TYPES } from '../enums/inventory'
import { idSchema, listQuerySchema } from './common'

const reportDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Date must be a valid date.')

const optionalFilterText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} must not be empty.`)
    .max(200, `${label} must be at most 200 characters.`)
    .optional()

const reportPaginationSchema = listQuerySchema.pick({
  page: true,
  pageSize: true,
})

const withValidDateRange = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape).refine(
    (value) => {
      const range = value as { dateFrom?: string; dateTo?: string }
      return !range.dateFrom || !range.dateTo || range.dateFrom <= range.dateTo
    },
    {
      message: 'Date From must not be after Date To.',
      path: ['dateTo'],
    },
  )

const stockCardShape = {
  ...reportPaginationSchema.shape,
  dateFrom: reportDateSchema.optional(),
  dateTo: reportDateSchema.optional(),
  deviceId: idSchema.optional(),
  deviceDetailId: idSchema.optional(),
  partNumber: optionalFilterText('Part Number'),
  dpn: optionalFilterText('DP/N'),
  rackId: idSchema.optional(),
  transactionType: z.enum(TRANSACTION_TYPES).optional(),
}

export const stockCardReportQuerySchema = withValidDateRange(stockCardShape)

export const stockCardByCustomerReportQuerySchema = withValidDateRange({
  ...stockCardShape,
  customerId: idSchema.optional(),
  modelId: idSchema.optional(),
  serviceTagId: idSchema.optional(),
})

const stockInShape = {
  ...reportPaginationSchema.shape,
  dateFrom: reportDateSchema.optional(),
  dateTo: reportDateSchema.optional(),
  deviceId: idSchema.optional(),
  deviceDetailId: idSchema.optional(),
  partNumber: optionalFilterText('Part Number'),
  dpn: optionalFilterText('DP/N'),
  rackId: idSchema.optional(),
  stockInType: z.enum(['ADJUSTMENT_IN', 'RETURN'] as const).optional(),
}

export const stockInReportQuerySchema = withValidDateRange(stockInShape)

export const stockInByCustomerReportQuerySchema = withValidDateRange({
  ...stockInShape,
  customerId: idSchema.optional(),
})

const stockOutShape = {
  ...reportPaginationSchema.shape,
  dateFrom: reportDateSchema.optional(),
  dateTo: reportDateSchema.optional(),
  engineerName: optionalFilterText('Engineer Name'),
  customerId: idSchema.optional(),
  modelId: idSchema.optional(),
  serviceTagId: idSchema.optional(),
  deviceId: idSchema.optional(),
  deviceDetailId: idSchema.optional(),
  partNumber: optionalFilterText('Part Number'),
  dpn: optionalFilterText('DP/N'),
  rackId: idSchema.optional(),
}

export const stockOutReportQuerySchema = withValidDateRange(stockOutShape)

export const stockOutByCustomerReportQuerySchema = withValidDateRange({
  ...stockOutShape,
  customerId: idSchema.optional(),
})

export type StockCardReportQuery = z.output<typeof stockCardReportQuerySchema>
export type StockCardByCustomerReportQuery = z.output<typeof stockCardByCustomerReportQuerySchema>
export type StockInReportQuery = z.output<typeof stockInReportQuerySchema>
export type StockInByCustomerReportQuery = z.output<typeof stockInByCustomerReportQuerySchema>
export type StockOutReportQuery = z.output<typeof stockOutReportQuerySchema>
export type StockOutByCustomerReportQuery = z.output<typeof stockOutByCustomerReportQuerySchema>
