import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/app'
import { VALIDATION_MESSAGES } from '../validation/messages'

export const idSchema = z
  .union([z.string(), z.bigint(), z.number().int().safe()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^[1-9]\d*$/, VALIDATION_MESSAGES.invalidId))

const queryBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')

export const listQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
  isActive: queryBooleanSchema.optional(),
})

export type ListQueryInput = z.input<typeof listQuerySchema>
export type ListQuery = z.output<typeof listQuerySchema>
