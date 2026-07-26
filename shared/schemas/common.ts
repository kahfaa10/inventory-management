import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/app'
import { VALIDATION_MESSAGES } from '../validation/messages'

export const POSTGRES_SIGNED_BIGINT_MAX = '9223372036854775807'
export const MAX_SAFE_PAGE = Math.floor(
  (Number.MAX_SAFE_INTEGER - MAX_PAGE_SIZE) / MAX_PAGE_SIZE + 1,
)

export const idSchema = z
  .union([z.string(), z.bigint(), z.number().int().safe()])
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(/^[1-9]\d*$/, VALIDATION_MESSAGES.invalidId)
      .refine(
        (value) =>
          value.length < POSTGRES_SIGNED_BIGINT_MAX.length ||
          (value.length === POSTGRES_SIGNED_BIGINT_MAX.length &&
            value <= POSTGRES_SIGNED_BIGINT_MAX),
        VALIDATION_MESSAGES.invalidId,
      ),
  )

const queryBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')

export const listQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(MAX_SAFE_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
  isActive: queryBooleanSchema.optional(),
})

export type ListQueryInput = z.input<typeof listQuerySchema>
export type ListQuery = z.output<typeof listQuerySchema>

export const serviceTagListQuerySchema = listQuerySchema.extend({
  modelId: idSchema.optional(),
  customerId: idSchema.optional(),
})

export const deviceDetailListQuerySchema = listQuerySchema.extend({
  deviceId: idSchema.optional(),
})

export type ServiceTagListQueryInput = z.input<typeof serviceTagListQuerySchema>
export type DeviceDetailListQueryInput = z.input<typeof deviceDetailListQuerySchema>
