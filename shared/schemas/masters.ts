import { z } from 'zod'
import { idSchema } from './common'
import { VALIDATION_MESSAGES } from '../validation/messages'

const requiredText = (field: string, maximum = 255) =>
  z
    .string()
    .trim()
    .min(1, VALIDATION_MESSAGES.required(field))
    .max(maximum, `${field} must be at most ${maximum} characters.`)

const optionalText = (maximum = 10_000) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => (value === '' ? undefined : value))

const nullableText = (maximum = 255) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === null || value === '' ? null : value,
    )

const createFields = {
  description: optionalText(),
  isActive: z.boolean().default(true),
}

const updateFields = {
  description: optionalText(),
  isActive: z.boolean().optional(),
}

const atLeastOneField = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  })

export const modelCreateSchema = z.strictObject({
  modelName: requiredText('Model Name'),
  ...createFields,
})
export const modelUpdateSchema = atLeastOneField({
  modelName: requiredText('Model Name').optional(),
  ...updateFields,
})

export const serviceTagCreateSchema = z.strictObject({
  modelId: idSchema,
  customerId: idSchema.nullable().optional().default(null),
  serviceTag: requiredText('Service Tag'),
  ...createFields,
})
export const serviceTagUpdateSchema = atLeastOneField({
  modelId: idSchema.optional(),
  customerId: idSchema.nullable().optional(),
  serviceTag: requiredText('Service Tag').optional(),
  ...updateFields,
})

export const deviceCreateSchema = z.strictObject({
  deviceName: requiredText('Device Name'),
  ...createFields,
})
export const deviceUpdateSchema = atLeastOneField({
  deviceName: requiredText('Device Name').optional(),
  ...updateFields,
})

export const deviceDetailCreateSchema = z.strictObject({
  deviceId: idSchema,
  partNumber: requiredText('Part Number'),
  dpn: nullableText(),
  specification: requiredText('Specification', 10_000),
  ...createFields,
})
export const deviceDetailUpdateSchema = atLeastOneField({
  deviceId: idSchema.optional(),
  partNumber: requiredText('Part Number').optional(),
  dpn: nullableText(),
  specification: requiredText('Specification', 10_000).optional(),
  ...updateFields,
})

export const customerCreateSchema = z.strictObject({
  customerName: requiredText('Customer Name'),
  address: optionalText(),
  contactPerson: optionalText(255),
  contactNumber: optionalText(100),
  ...createFields,
})
export const customerUpdateSchema = atLeastOneField({
  customerName: requiredText('Customer Name').optional(),
  address: optionalText(),
  contactPerson: optionalText(255),
  contactNumber: optionalText(100),
  ...updateFields,
})

export const rackCreateSchema = z.strictObject({
  rackCode: requiredText('Rack Code'),
  rackName: requiredText('Rack Name'),
  ...createFields,
})
export const rackUpdateSchema = atLeastOneField({
  rackCode: requiredText('Rack Code').optional(),
  rackName: requiredText('Rack Name').optional(),
  ...updateFields,
})

export type ModelCreateInput = z.input<typeof modelCreateSchema>
export type ModelUpdateInput = z.input<typeof modelUpdateSchema>
export type ServiceTagCreateInput = z.input<typeof serviceTagCreateSchema>
export type ServiceTagUpdateInput = z.input<typeof serviceTagUpdateSchema>
export type DeviceCreateInput = z.input<typeof deviceCreateSchema>
export type DeviceUpdateInput = z.input<typeof deviceUpdateSchema>
export type DeviceDetailCreateInput = z.input<typeof deviceDetailCreateSchema>
export type DeviceDetailUpdateInput = z.input<typeof deviceDetailUpdateSchema>
export type CustomerCreateInput = z.input<typeof customerCreateSchema>
export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>
export type RackCreateInput = z.input<typeof rackCreateSchema>
export type RackUpdateInput = z.input<typeof rackUpdateSchema>
