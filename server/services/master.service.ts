import type { Prisma } from '../../generated/prisma/client'
import type { ZodType } from 'zod'
import {
  deviceDetailListQuerySchema,
  listQuerySchema,
  serviceTagListQuerySchema,
  type DeviceDetailListQueryInput,
  type ListQueryInput,
  type ServiceTagListQueryInput,
} from '../../shared/schemas/common'
import {
  customerCreateSchema,
  customerUpdateSchema,
  deviceCreateSchema,
  deviceDetailCreateSchema,
  deviceDetailUpdateSchema,
  deviceUpdateSchema,
  modelCreateSchema,
  modelUpdateSchema,
  rackCreateSchema,
  rackUpdateSchema,
  serviceTagCreateSchema,
  serviceTagUpdateSchema,
  type CustomerCreateInput,
  type CustomerUpdateInput,
  type DeviceCreateInput,
  type DeviceDetailCreateInput,
  type DeviceDetailUpdateInput,
  type DeviceUpdateInput,
  type ModelCreateInput,
  type ModelUpdateInput,
  type RackCreateInput,
  type RackUpdateInput,
  type ServiceTagCreateInput,
  type ServiceTagUpdateInput,
} from '../../shared/schemas/masters'
import type { PaginatedResponse } from '../../shared/types/api'
import type {
  CustomerDto,
  DeviceDetailDto,
  DeviceDto,
  ModelDto,
  RackDto,
  ServiceTagDto,
} from '../../shared/types/masters'
import { prisma } from '../utils/prisma'
import { executeMasterWrite, inactiveMasterError, notFoundError } from '../utils/prisma-errors'
import { parseBody, parseQuery } from '../utils/validation'

type ActorId = bigint | string

const serviceTagInclude = {
  model: { select: { id: true, modelName: true, isActive: true } },
  customer: { select: { id: true, customerName: true, isActive: true } },
} satisfies Prisma.ServiceTagInclude

const deviceDetailInclude = {
  device: { select: { id: true, deviceName: true, isActive: true } },
} satisfies Prisma.DeviceDetailInclude

type ServiceTagRecord = Prisma.ServiceTagGetPayload<{ include: typeof serviceTagInclude }>
type DeviceDetailRecord = Prisma.DeviceDetailGetPayload<{ include: typeof deviceDetailInclude }>

function acknowledgeActor(actorId: ActorId) {
  const parsed = BigInt(actorId)
  if (parsed <= BigInt(0)) throw new TypeError('Actor ID must be a positive integer.')
}

function pageArguments<T extends ListQueryInput>(schema: typeof listQuerySchema, query: T) {
  const parsed = parseQuery(schema, query)
  return {
    query: parsed,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize,
  }
}

function pageArgumentsWithSchema<T>(
  schema: ZodType<T>,
  query: unknown,
): { query: T; skip: number; take: number } {
  const parsed = parseQuery(schema, query) as T & { page: number; pageSize: number }
  return {
    query: parsed,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize,
  }
}

function modelDto(record: {
  id: bigint
  modelName: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): ModelDto {
  return {
    id: record.id.toString(),
    modelName: record.modelName,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function serviceTagDto(record: ServiceTagRecord): ServiceTagDto {
  return {
    id: record.id.toString(),
    modelId: record.modelId.toString(),
    customerId: record.customerId?.toString() ?? null,
    serviceTag: record.serviceTag,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    model: {
      id: record.model.id.toString(),
      modelName: record.model.modelName,
      isActive: record.model.isActive,
    },
    customer: record.customer
      ? {
          id: record.customer.id.toString(),
          customerName: record.customer.customerName,
          isActive: record.customer.isActive,
        }
      : null,
  }
}

function deviceDto(record: {
  id: bigint
  deviceName: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): DeviceDto {
  return {
    id: record.id.toString(),
    deviceName: record.deviceName,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function deviceDetailDto(record: DeviceDetailRecord): DeviceDetailDto {
  return {
    id: record.id.toString(),
    deviceId: record.deviceId.toString(),
    partNumber: record.partNumber,
    dpn: record.dpn,
    specification: record.specification,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    device: {
      id: record.device.id.toString(),
      deviceName: record.device.deviceName,
      isActive: record.device.isActive,
    },
  }
}

function customerDto(record: {
  id: bigint
  customerName: string
  address: string | null
  contactPerson: string | null
  contactNumber: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): CustomerDto {
  return {
    id: record.id.toString(),
    customerName: record.customerName,
    address: record.address,
    contactPerson: record.contactPerson,
    contactNumber: record.contactNumber,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function rackDto(record: {
  id: bigint
  rackCode: string
  rackName: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): RackDto {
  return {
    id: record.id.toString(),
    rackCode: record.rackCode,
    rackName: record.rackName,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function requireActiveModel(id: string) {
  const model = await prisma.model.findUnique({ where: { id: BigInt(id) } })
  if (!model) throw notFoundError()
  if (!model.isActive) throw inactiveMasterError()
}

async function requireActiveCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id: BigInt(id) } })
  if (!customer) throw notFoundError()
  if (!customer.isActive) throw inactiveMasterError()
}

async function requireActiveDevice(id: string) {
  const device = await prisma.device.findUnique({ where: { id: BigInt(id) } })
  if (!device) throw notFoundError()
  if (!device.isActive) throw inactiveMasterError()
}

export async function listModels(query: ListQueryInput = {}): Promise<PaginatedResponse<ModelDto>> {
  const { query: parsed, skip, take } = pageArguments(listQuerySchema, query)
  const where: Prisma.ModelWhereInput = {
    ...(parsed.search
      ? { modelName: { contains: parsed.search, mode: 'insensitive' as const } }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.model.findMany({ where, orderBy: [{ modelName: 'asc' }, { id: 'asc' }], skip, take }),
    prisma.model.count({ where }),
  ])
  return { data: data.map(modelDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getModel(id: string): Promise<ModelDto> {
  const record = await prisma.model.findUnique({ where: { id: BigInt(id) } })
  if (!record) throw notFoundError()
  return modelDto(record)
}

export async function createModel(actorId: ActorId, input: ModelCreateInput): Promise<ModelDto> {
  acknowledgeActor(actorId)
  const value = parseBody(modelCreateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.model.create({
      data: {
        modelName: value.modelName,
        description: value.description ?? null,
        isActive: value.isActive,
      },
    }),
  )
  return modelDto(record)
}

export async function updateModel(
  actorId: ActorId,
  id: string,
  input: ModelUpdateInput,
): Promise<ModelDto> {
  acknowledgeActor(actorId)
  const value = parseBody(modelUpdateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.model.update({
      where: { id: BigInt(id) },
      data: {
        ...('modelName' in value ? { modelName: value.modelName } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
    }),
  )
  return modelDto(record)
}

export async function listServiceTags(
  query: ServiceTagListQueryInput = {},
): Promise<PaginatedResponse<ServiceTagDto>> {
  const { query: parsed, skip, take } = pageArgumentsWithSchema(serviceTagListQuerySchema, query)
  const where: Prisma.ServiceTagWhereInput = {
    ...(parsed.search
      ? {
          OR: [
            { serviceTag: { contains: parsed.search, mode: 'insensitive' as const } },
            { model: { modelName: { contains: parsed.search, mode: 'insensitive' as const } } },
            {
              customer: {
                customerName: { contains: parsed.search, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
    ...(parsed.modelId === undefined ? {} : { modelId: BigInt(parsed.modelId) }),
    ...(parsed.customerId === undefined ? {} : { customerId: BigInt(parsed.customerId) }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.serviceTag.findMany({
      where,
      include: serviceTagInclude,
      orderBy: [{ serviceTag: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.serviceTag.count({ where }),
  ])
  return { data: data.map(serviceTagDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getServiceTag(id: string): Promise<ServiceTagDto> {
  const record = await prisma.serviceTag.findUnique({
    where: { id: BigInt(id) },
    include: serviceTagInclude,
  })
  if (!record) throw notFoundError()
  return serviceTagDto(record)
}

export async function createServiceTag(
  actorId: ActorId,
  input: ServiceTagCreateInput,
): Promise<ServiceTagDto> {
  acknowledgeActor(actorId)
  const value = parseBody(serviceTagCreateSchema, input)
  await requireActiveModel(value.modelId)
  if (value.customerId) await requireActiveCustomer(value.customerId)

  const record = await executeMasterWrite(() =>
    prisma.serviceTag.create({
      data: {
        modelId: BigInt(value.modelId),
        customerId: value.customerId ? BigInt(value.customerId) : null,
        serviceTag: value.serviceTag,
        description: value.description ?? null,
        isActive: value.isActive,
      },
      include: serviceTagInclude,
    }),
  )
  return serviceTagDto(record)
}

export async function updateServiceTag(
  actorId: ActorId,
  id: string,
  input: ServiceTagUpdateInput,
): Promise<ServiceTagDto> {
  acknowledgeActor(actorId)
  const value = parseBody(serviceTagUpdateSchema, input)
  const current = await prisma.serviceTag.findUnique({ where: { id: BigInt(id) } })
  if (!current) throw notFoundError()

  if (value.modelId !== undefined && BigInt(value.modelId) !== current.modelId) {
    await requireActiveModel(value.modelId)
  }
  if (
    value.customerId !== undefined &&
    value.customerId !== null &&
    BigInt(value.customerId) !== current.customerId
  ) {
    await requireActiveCustomer(value.customerId)
  }

  const record = await executeMasterWrite(() =>
    prisma.serviceTag.update({
      where: { id: current.id },
      data: {
        ...(value.modelId !== undefined ? { modelId: BigInt(value.modelId) } : {}),
        ...(value.customerId !== undefined
          ? { customerId: value.customerId === null ? null : BigInt(value.customerId) }
          : {}),
        ...('serviceTag' in value ? { serviceTag: value.serviceTag } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
      include: serviceTagInclude,
    }),
  )
  return serviceTagDto(record)
}

export async function listDevices(
  query: ListQueryInput = {},
): Promise<PaginatedResponse<DeviceDto>> {
  const { query: parsed, skip, take } = pageArguments(listQuerySchema, query)
  const where: Prisma.DeviceWhereInput = {
    ...(parsed.search
      ? { deviceName: { contains: parsed.search, mode: 'insensitive' as const } }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.device.findMany({ where, orderBy: [{ deviceName: 'asc' }, { id: 'asc' }], skip, take }),
    prisma.device.count({ where }),
  ])
  return { data: data.map(deviceDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getDevice(id: string): Promise<DeviceDto> {
  const record = await prisma.device.findUnique({ where: { id: BigInt(id) } })
  if (!record) throw notFoundError()
  return deviceDto(record)
}

export async function createDevice(actorId: ActorId, input: DeviceCreateInput): Promise<DeviceDto> {
  acknowledgeActor(actorId)
  const value = parseBody(deviceCreateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.device.create({
      data: {
        deviceName: value.deviceName,
        description: value.description ?? null,
        isActive: value.isActive,
      },
    }),
  )
  return deviceDto(record)
}

export async function updateDevice(
  actorId: ActorId,
  id: string,
  input: DeviceUpdateInput,
): Promise<DeviceDto> {
  acknowledgeActor(actorId)
  const value = parseBody(deviceUpdateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.device.update({
      where: { id: BigInt(id) },
      data: {
        ...('deviceName' in value ? { deviceName: value.deviceName } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
    }),
  )
  return deviceDto(record)
}

export async function listDeviceDetails(
  query: DeviceDetailListQueryInput = {},
): Promise<PaginatedResponse<DeviceDetailDto>> {
  const { query: parsed, skip, take } = pageArgumentsWithSchema(deviceDetailListQuerySchema, query)
  const where: Prisma.DeviceDetailWhereInput = {
    ...(parsed.search
      ? {
          OR: [
            { partNumber: { contains: parsed.search, mode: 'insensitive' as const } },
            { dpn: { contains: parsed.search, mode: 'insensitive' as const } },
            { specification: { contains: parsed.search, mode: 'insensitive' as const } },
            { device: { deviceName: { contains: parsed.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
    ...(parsed.deviceId === undefined ? {} : { deviceId: BigInt(parsed.deviceId) }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.deviceDetail.findMany({
      where,
      include: deviceDetailInclude,
      orderBy: [{ partNumber: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.deviceDetail.count({ where }),
  ])
  return { data: data.map(deviceDetailDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getDeviceDetail(id: string): Promise<DeviceDetailDto> {
  const record = await prisma.deviceDetail.findUnique({
    where: { id: BigInt(id) },
    include: deviceDetailInclude,
  })
  if (!record) throw notFoundError()
  return deviceDetailDto(record)
}

export async function createDeviceDetail(
  actorId: ActorId,
  input: DeviceDetailCreateInput,
): Promise<DeviceDetailDto> {
  acknowledgeActor(actorId)
  const value = parseBody(deviceDetailCreateSchema, input)
  await requireActiveDevice(value.deviceId)
  const record = await executeMasterWrite(() =>
    prisma.deviceDetail.create({
      data: {
        deviceId: BigInt(value.deviceId),
        partNumber: value.partNumber,
        dpn: value.dpn,
        specification: value.specification,
        description: value.description ?? null,
        isActive: value.isActive,
      },
      include: deviceDetailInclude,
    }),
  )
  return deviceDetailDto(record)
}

export async function updateDeviceDetail(
  actorId: ActorId,
  id: string,
  input: DeviceDetailUpdateInput,
): Promise<DeviceDetailDto> {
  acknowledgeActor(actorId)
  const value = parseBody(deviceDetailUpdateSchema, input)
  const current = await prisma.deviceDetail.findUnique({ where: { id: BigInt(id) } })
  if (!current) throw notFoundError()
  if (value.deviceId !== undefined && BigInt(value.deviceId) !== current.deviceId) {
    await requireActiveDevice(value.deviceId)
  }

  const record = await executeMasterWrite(() =>
    prisma.deviceDetail.update({
      where: { id: current.id },
      data: {
        ...(value.deviceId !== undefined ? { deviceId: BigInt(value.deviceId) } : {}),
        ...('partNumber' in value ? { partNumber: value.partNumber } : {}),
        ...('dpn' in value ? { dpn: value.dpn } : {}),
        ...('specification' in value ? { specification: value.specification } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
      include: deviceDetailInclude,
    }),
  )
  return deviceDetailDto(record)
}

export async function listCustomers(
  query: ListQueryInput = {},
): Promise<PaginatedResponse<CustomerDto>> {
  const { query: parsed, skip, take } = pageArguments(listQuerySchema, query)
  const where: Prisma.CustomerWhereInput = {
    ...(parsed.search
      ? {
          OR: [
            { customerName: { contains: parsed.search, mode: 'insensitive' as const } },
            { contactPerson: { contains: parsed.search, mode: 'insensitive' as const } },
            { contactNumber: { contains: parsed.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: [{ customerName: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.customer.count({ where }),
  ])
  return { data: data.map(customerDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getCustomer(id: string): Promise<CustomerDto> {
  const record = await prisma.customer.findUnique({ where: { id: BigInt(id) } })
  if (!record) throw notFoundError()
  return customerDto(record)
}

export async function createCustomer(
  actorId: ActorId,
  input: CustomerCreateInput,
): Promise<CustomerDto> {
  acknowledgeActor(actorId)
  const value = parseBody(customerCreateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.customer.create({
      data: {
        customerName: value.customerName,
        address: value.address ?? null,
        contactPerson: value.contactPerson ?? null,
        contactNumber: value.contactNumber ?? null,
        description: value.description ?? null,
        isActive: value.isActive,
      },
    }),
  )
  return customerDto(record)
}

export async function updateCustomer(
  actorId: ActorId,
  id: string,
  input: CustomerUpdateInput,
): Promise<CustomerDto> {
  acknowledgeActor(actorId)
  const value = parseBody(customerUpdateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.customer.update({
      where: { id: BigInt(id) },
      data: {
        ...('customerName' in value ? { customerName: value.customerName } : {}),
        ...('address' in value ? { address: value.address ?? null } : {}),
        ...('contactPerson' in value ? { contactPerson: value.contactPerson ?? null } : {}),
        ...('contactNumber' in value ? { contactNumber: value.contactNumber ?? null } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
    }),
  )
  return customerDto(record)
}

export async function listRacks(query: ListQueryInput = {}): Promise<PaginatedResponse<RackDto>> {
  const { query: parsed, skip, take } = pageArguments(listQuerySchema, query)
  const where: Prisma.RackWhereInput = {
    ...(parsed.search
      ? {
          OR: [
            { rackCode: { contains: parsed.search, mode: 'insensitive' as const } },
            { rackName: { contains: parsed.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.rack.findMany({
      where,
      orderBy: [{ rackCode: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.rack.count({ where }),
  ])
  return { data: data.map(rackDto), page: parsed.page, pageSize: parsed.pageSize, total }
}

export async function getRack(id: string): Promise<RackDto> {
  const record = await prisma.rack.findUnique({ where: { id: BigInt(id) } })
  if (!record) throw notFoundError()
  return rackDto(record)
}

export async function createRack(actorId: ActorId, input: RackCreateInput): Promise<RackDto> {
  acknowledgeActor(actorId)
  const value = parseBody(rackCreateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.rack.create({
      data: {
        rackCode: value.rackCode,
        rackName: value.rackName,
        description: value.description ?? null,
        isActive: value.isActive,
      },
    }),
  )
  return rackDto(record)
}

export async function updateRack(
  actorId: ActorId,
  id: string,
  input: RackUpdateInput,
): Promise<RackDto> {
  acknowledgeActor(actorId)
  const value = parseBody(rackUpdateSchema, input)
  const record = await executeMasterWrite(() =>
    prisma.rack.update({
      where: { id: BigInt(id) },
      data: {
        ...('rackCode' in value ? { rackCode: value.rackCode } : {}),
        ...('rackName' in value ? { rackName: value.rackName } : {}),
        ...('description' in value ? { description: value.description ?? null } : {}),
        ...('isActive' in value ? { isActive: value.isActive } : {}),
      },
    }),
  )
  return rackDto(record)
}
