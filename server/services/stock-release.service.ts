import {
  MovementPurpose,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client'
import {
  stockReleaseCreateSchema,
  stockReleaseListQuerySchema,
  stockReleaseUpdateSchema,
  type StockReleaseCreate,
  type StockReleaseCreateInput,
  type StockReleaseListQueryInput,
  type StockReleaseUpdateInput,
} from '../../shared/schemas/stock-release'
import type { PaginatedResponse } from '../../shared/types/api'
import type {
  StockReleaseDetailDto,
  StockReleaseDto,
  StockReleaseReturnableDto,
} from '../../shared/types/transactions'
import {
  createStockReleaseRecord,
  findStockReleaseRecord,
  findStockReleaseState,
  listStockReleaseRecords,
  replaceStockReleaseDraft,
  transitionStockReleaseStatus,
  type StockReleaseDetailWrite,
  type StockReleaseRecord,
  type StockReleaseState,
} from '../repositories/stock-release.repository'
import { ApiError } from '../utils/api-error'
import { inactiveMasterError, notFoundError } from '../utils/prisma-errors'
import { prisma } from '../utils/prisma'
import { lockStockKeys, lockStockReleaseDetailRows } from '../utils/stock-lock'
import { runInventoryTransaction } from '../utils/transaction'
import { parseBody, parseQuery } from '../utils/validation'
import { reverseOutboundStockMovements } from './cancellation.service'
import { getStockBalance, getStockBalances, stockBalanceKey } from './stock.service'
import { nextTransactionNumber } from './transaction-number.service'

type ActorId = bigint | string

function positiveBigInt(value: bigint | string, label: string): bigint {
  let parsed: bigint
  try {
    parsed = BigInt(value)
  } catch {
    throw new TypeError(`${label} must be a positive integer.`)
  }
  if (parsed <= 0) throw new TypeError(`${label} must be a positive integer.`)
  return parsed
}

function releaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function invalidState(message: string): ApiError {
  return new ApiError(409, 'INVALID_TRANSACTION_STATE', message)
}

function serviceTagMismatch(): ApiError {
  return new ApiError(
    422,
    'SERVICE_TAG_MISMATCH',
    'Service Tag must belong to the selected Model and Customer.',
    {
      serviceTagId: ['Service Tag must belong to the selected Model and Customer.'],
    },
  )
}

function insufficientStockError(
  availableQuantity: number,
  detailIndexes: readonly number[],
): ApiError {
  const message = `Released quantity cannot exceed available stock. Available quantity: ${availableQuantity}.`
  return new ApiError(
    409,
    'INSUFFICIENT_STOCK',
    message,
    Object.fromEntries(
      detailIndexes.map((index) => [`details.${index}.releasedQuantity`, [message]]),
    ),
  )
}

function detailDto(
  detail: StockReleaseRecord['details'][number],
  balances: ReadonlyMap<string, number>,
): StockReleaseDetailDto {
  return {
    id: detail.id.toString(),
    deviceDetailId: detail.deviceDetailId.toString(),
    sourceRackId: detail.rackId.toString(),
    releasedQuantity: detail.releasedQuantity,
    availableQuantity: balances.get(stockBalanceKey(detail.deviceDetailId, detail.rackId)) ?? 0,
    notes: detail.notes,
    deviceDetail: {
      id: detail.deviceDetail.id.toString(),
      deviceId: detail.deviceDetail.deviceId.toString(),
      partNumber: detail.deviceDetail.partNumber,
      dpn: detail.deviceDetail.dpn,
      specification: detail.deviceDetail.specification,
      isActive: detail.deviceDetail.isActive,
      device: {
        id: detail.deviceDetail.device.id.toString(),
        deviceName: detail.deviceDetail.device.deviceName,
        isActive: detail.deviceDetail.device.isActive,
      },
    },
    sourceRack: {
      id: detail.rack.id.toString(),
      rackCode: detail.rack.rackCode,
      rackName: detail.rack.rackName,
      isActive: detail.rack.isActive,
    },
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
  }
}

function releaseDto(
  record: StockReleaseRecord,
  balances: ReadonlyMap<string, number>,
): StockReleaseDto {
  return {
    id: record.id.toString(),
    transactionNumber: record.transactionNumber,
    releaseDate: record.releaseDate.toISOString().slice(0, 10),
    engineerName: record.engineerName,
    customerId: record.customerId.toString(),
    customer: {
      id: record.customer.id.toString(),
      customerName: record.customer.customerName,
      isActive: record.customer.isActive,
    },
    modelId: record.modelId?.toString() ?? null,
    model: record.model
      ? {
          id: record.model.id.toString(),
          modelName: record.model.modelName,
          isActive: record.model.isActive,
        }
      : null,
    serviceTagId: record.serviceTagId?.toString() ?? null,
    serviceTag: record.serviceTag
      ? {
          id: record.serviceTag.id.toString(),
          serviceTag: record.serviceTag.serviceTag,
          modelId: record.serviceTag.modelId.toString(),
          customerId: record.serviceTag.customerId?.toString() ?? null,
          isActive: record.serviceTag.isActive,
        }
      : null,
    referenceNumber: record.referenceNumber,
    notes: record.notes,
    status: record.status,
    createdById: record.createdById.toString(),
    createdBy: {
      id: record.createdBy.id.toString(),
      displayName: record.createdBy.displayName,
    },
    details: record.details.map((detail) => detailDto(detail, balances)),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function detailWrites(value: StockReleaseCreate): StockReleaseDetailWrite[] {
  return value.details.map((detail) => ({
    deviceDetailId: BigInt(detail.deviceDetailId),
    rackId: BigInt(detail.sourceRackId),
    releasedQuantity: detail.releasedQuantity,
    notes: detail.notes,
  }))
}

async function validateActiveMasters(
  tx: Prisma.TransactionClient,
  value: StockReleaseCreate,
): Promise<void> {
  const customerId = BigInt(value.customerId)
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { isActive: true },
  })
  if (!customer) throw notFoundError()
  if (!customer.isActive) throw inactiveMasterError()

  const modelId = value.modelId ? BigInt(value.modelId) : null
  if (modelId) {
    const model = await tx.model.findUnique({
      where: { id: modelId },
      select: { isActive: true },
    })
    if (!model) throw notFoundError()
    if (!model.isActive) throw inactiveMasterError()
  }

  if (value.serviceTagId) {
    const serviceTag = await tx.serviceTag.findUnique({
      where: { id: BigInt(value.serviceTagId) },
      select: {
        modelId: true,
        customerId: true,
        isActive: true,
        model: { select: { isActive: true } },
      },
    })
    if (!serviceTag) throw notFoundError()
    if (!serviceTag.isActive || !serviceTag.model.isActive) throw inactiveMasterError()
    if (
      modelId === null ||
      serviceTag.modelId !== modelId ||
      serviceTag.customerId === null ||
      serviceTag.customerId !== customerId
    ) {
      throw serviceTagMismatch()
    }
  }

  const deviceDetailIds = [
    ...new Set(value.details.map(({ deviceDetailId }) => deviceDetailId)),
  ].map(BigInt)
  const rackIds = [...new Set(value.details.map(({ sourceRackId }) => sourceRackId))].map(BigInt)
  const deviceDetails = await tx.deviceDetail.findMany({
    where: { id: { in: deviceDetailIds } },
    select: { id: true, deviceId: true, isActive: true },
  })
  const parentDeviceIds = [...new Set(deviceDetails.map(({ deviceId }) => deviceId))]
  const parentDevices = await tx.device.findMany({
    where: { id: { in: parentDeviceIds } },
    select: { id: true, isActive: true },
  })
  const racks = await tx.rack.findMany({
    where: { id: { in: rackIds } },
    select: { id: true, isActive: true },
  })

  if (deviceDetails.length !== deviceDetailIds.length || racks.length !== rackIds.length) {
    throw notFoundError()
  }
  if (
    deviceDetails.some((detail) => !detail.isActive) ||
    parentDevices.length !== parentDeviceIds.length ||
    parentDevices.some((device) => !device.isActive) ||
    racks.some((rack) => !rack.isActive)
  ) {
    throw inactiveMasterError()
  }
}

async function lockReleaseHeader(tx: Prisma.TransactionClient, id: bigint): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT "id"
    FROM "stock_releases"
    WHERE "id" = ${id}
    FOR UPDATE
  `)
}

function recordAsValidationValue(record: StockReleaseState): StockReleaseCreate {
  return {
    releaseDate: record.releaseDate.toISOString().slice(0, 10),
    engineerName: record.engineerName,
    customerId: record.customerId.toString(),
    modelId: record.modelId?.toString() ?? null,
    serviceTagId: record.serviceTagId?.toString() ?? null,
    referenceNumber: record.referenceNumber,
    notes: record.notes,
    details: record.details.map((detail) => ({
      deviceDetailId: detail.deviceDetailId.toString(),
      sourceRackId: detail.rackId.toString(),
      releasedQuantity: detail.releasedQuantity,
      notes: detail.notes,
    })),
  }
}

async function requireRelease(
  tx: Prisma.TransactionClient,
  id: bigint,
): Promise<StockReleaseState> {
  const record = await findStockReleaseState(tx, id)
  if (!record) throw notFoundError()
  return record
}

interface AggregatedRelease {
  deviceDetailId: bigint
  rackId: bigint
  quantity: number
  detailIndexes: number[]
}

function aggregateReleaseDetails(details: StockReleaseState['details']): AggregatedRelease[] {
  const aggregates = new Map<string, AggregatedRelease>()
  details.forEach((detail, index) => {
    const key = `${detail.deviceDetailId}:${detail.rackId}`
    const aggregate = aggregates.get(key)
    if (aggregate) {
      aggregate.quantity += detail.releasedQuantity
      aggregate.detailIndexes.push(index)
    } else {
      aggregates.set(key, {
        deviceDetailId: detail.deviceDetailId,
        rackId: detail.rackId,
        quantity: detail.releasedQuantity,
        detailIndexes: [index],
      })
    }
  })
  return [...aggregates.values()]
}

export async function listStockReleases(
  query: StockReleaseListQueryInput = {},
): Promise<PaginatedResponse<StockReleaseDto>> {
  const value = parseQuery(stockReleaseListQuerySchema, query)
  const where: Prisma.StockReleaseWhereInput = {
    ...(value.search
      ? {
          OR: [
            { transactionNumber: { contains: value.search, mode: 'insensitive' as const } },
            { engineerName: { contains: value.search, mode: 'insensitive' as const } },
            { referenceNumber: { contains: value.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(value.status ? { status: value.status } : {}),
    ...(value.customerId ? { customerId: BigInt(value.customerId) } : {}),
    ...(value.modelId ? { modelId: BigInt(value.modelId) } : {}),
    ...(value.serviceTagId ? { serviceTagId: BigInt(value.serviceTagId) } : {}),
    ...(value.dateFrom || value.dateTo
      ? {
          releaseDate: {
            ...(value.dateFrom ? { gte: releaseDate(value.dateFrom) } : {}),
            ...(value.dateTo ? { lte: releaseDate(value.dateTo) } : {}),
          },
        }
      : {}),
  }
  const result = await listStockReleaseRecords({
    where,
    skip: (value.page - 1) * value.pageSize,
    take: value.pageSize,
  })
  const balances = await getStockBalances(
    prisma,
    result.data.flatMap((record) =>
      record.details.map(({ deviceDetailId, rackId }) => ({ deviceDetailId, rackId })),
    ),
  )
  const data = result.data.map((record) => releaseDto(record, balances))
  return { data, page: value.page, pageSize: value.pageSize, total: result.total }
}

export async function getStockRelease(id: string): Promise<StockReleaseDto> {
  const record = await findStockReleaseRecord(prisma, positiveBigInt(id, 'Transaction ID'))
  if (!record) throw notFoundError()
  const balances = await getStockBalances(
    prisma,
    record.details.map(({ deviceDetailId, rackId }) => ({ deviceDetailId, rackId })),
  )
  return releaseDto(record, balances)
}

export async function createStockRelease(
  actorId: ActorId,
  input: StockReleaseCreateInput,
): Promise<StockReleaseDto> {
  const actor = positiveBigInt(actorId, 'Actor ID')
  const value = parseBody(stockReleaseCreateSchema, input)
  const id = await runInventoryTransaction(async (tx) => {
    await validateActiveMasters(tx, value)
    const date = releaseDate(value.releaseDate)
    const number = await nextTransactionNumber(tx, TransactionType.STOCK_RELEASE, date)
    return createStockReleaseRecord(tx, {
      transactionNumber: number,
      releaseDate: date,
      engineerName: value.engineerName,
      customerId: BigInt(value.customerId),
      modelId: value.modelId ? BigInt(value.modelId) : null,
      serviceTagId: value.serviceTagId ? BigInt(value.serviceTagId) : null,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
      createdById: actor,
      details: detailWrites(value),
    })
  })
  return getStockRelease(id.toString())
}

export async function updateStockRelease(
  actorId: ActorId,
  id: string,
  input: StockReleaseUpdateInput,
): Promise<StockReleaseDto> {
  positiveBigInt(actorId, 'Actor ID')
  const releaseId = positiveBigInt(id, 'Transaction ID')
  const value = parseBody(stockReleaseUpdateSchema, input)
  await runInventoryTransaction(async (tx) => {
    await lockReleaseHeader(tx, releaseId)
    const current = await requireRelease(tx, releaseId)
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Only Draft stock releases may be updated.')
    }
    await validateActiveMasters(tx, value)
    await replaceStockReleaseDraft(tx, releaseId, {
      releaseDate: releaseDate(value.releaseDate),
      engineerName: value.engineerName,
      customerId: BigInt(value.customerId),
      modelId: value.modelId ? BigInt(value.modelId) : null,
      serviceTagId: value.serviceTagId ? BigInt(value.serviceTagId) : null,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
      details: detailWrites(value),
    })
  })
  return getStockRelease(releaseId.toString())
}

export async function completeStockRelease(id: string, actorId: ActorId): Promise<StockReleaseDto> {
  const releaseId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')
  await runInventoryTransaction(async (tx) => {
    await lockReleaseHeader(tx, releaseId)
    let current = await requireRelease(tx, releaseId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled stock releases cannot be completed.')
    }
    if (current.details.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'At least one transaction detail is required.')
    }

    const aggregates = aggregateReleaseDetails(current.details)
    await lockStockKeys(tx, aggregates)
    current = await requireRelease(tx, releaseId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled stock releases cannot be completed.')
    }
    await validateActiveMasters(tx, recordAsValidationValue(current))

    for (const aggregate of aggregateReleaseDetails(current.details)) {
      const available = await getStockBalance(tx, aggregate.deviceDetailId, aggregate.rackId)
      if (available < aggregate.quantity) {
        throw insufficientStockError(available, aggregate.detailIndexes)
      }
    }

    await tx.stockMovement.createMany({
      data: current.details.map((detail) => ({
        deviceDetailId: detail.deviceDetailId,
        rackId: detail.rackId,
        customerId: current.customerId,
        transactionType: TransactionType.STOCK_RELEASE,
        transactionId: current.id,
        transactionDetailId: detail.id,
        transactionNumber: current.transactionNumber,
        transactionDate: current.releaseDate,
        engineerName: current.engineerName,
        quantityIn: 0,
        quantityOut: detail.releasedQuantity,
        movementPurpose: MovementPurpose.ORIGINAL,
        createdById: actor,
      })),
    })
    if (
      !(await transitionStockReleaseStatus(
        tx,
        releaseId,
        TransactionStatus.DRAFT,
        TransactionStatus.COMPLETED,
      ))
    ) {
      throw invalidState('Stock release was changed by another request.')
    }
  })
  return getStockRelease(releaseId.toString())
}

export async function cancelStockRelease(id: string, actorId: ActorId): Promise<StockReleaseDto> {
  const releaseId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')
  await runInventoryTransaction(async (tx) => {
    await lockReleaseHeader(tx, releaseId)
    const current = await requireRelease(tx, releaseId)
    if (current.status === TransactionStatus.CANCELLED) return
    if (current.status === TransactionStatus.DRAFT) {
      if (
        !(await transitionStockReleaseStatus(
          tx,
          releaseId,
          TransactionStatus.DRAFT,
          TransactionStatus.CANCELLED,
        ))
      ) {
        throw invalidState('Stock release was changed by another request.')
      }
      return
    }

    await lockStockReleaseDetailRows(tx, releaseId)
    const completedReturn = await tx.stockReturn.findFirst({
      where: { stockReleaseId: releaseId, status: TransactionStatus.COMPLETED },
      select: { id: true },
    })
    if (completedReturn) {
      throw new ApiError(
        409,
        'COMPLETED_RETURN_EXISTS',
        'Completed Stock Returns must be cancelled before cancelling this Stock Release.',
      )
    }

    const originals = await tx.stockMovement.findMany({
      where: {
        transactionType: TransactionType.STOCK_RELEASE,
        transactionId: releaseId,
        movementPurpose: MovementPurpose.ORIGINAL,
      },
      orderBy: { id: 'asc' },
    })
    const detailsById = new Map(current.details.map((detail) => [detail.id, detail]))
    const invalidOriginal =
      originals.length !== current.details.length ||
      originals.some((original) => {
        const detail = detailsById.get(original.transactionDetailId)
        return (
          !detail ||
          original.transactionNumber !== current.transactionNumber ||
          original.transactionDate.getTime() !== current.releaseDate.getTime() ||
          original.customerId !== current.customerId ||
          original.engineerName !== current.engineerName ||
          original.deviceDetailId !== detail.deviceDetailId ||
          original.rackId !== detail.rackId ||
          original.quantityIn !== 0 ||
          original.quantityOut !== detail.releasedQuantity
        )
      })
    if (invalidOriginal) {
      throw new ApiError(
        409,
        'INVALID_CANCELLATION_SOURCE',
        'Completed stock release movements are incomplete.',
      )
    }

    await reverseOutboundStockMovements(tx, originals, actor)
    if (
      !(await transitionStockReleaseStatus(
        tx,
        releaseId,
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
      ))
    ) {
      throw invalidState('Stock release was changed by another request.')
    }
  })
  return getStockRelease(releaseId.toString())
}

export async function getStockReleaseReturnable(id: string): Promise<StockReleaseReturnableDto> {
  const record = await findStockReleaseRecord(prisma, positiveBigInt(id, 'Transaction ID'))
  if (!record) throw notFoundError()
  if (record.status !== TransactionStatus.COMPLETED) {
    throw invalidState('Only Completed stock releases have returnable quantities.')
  }

  const details: StockReleaseReturnableDto['details'] = []
  for (const detail of record.details) {
    const returned = await prisma.stockReturnDetail.aggregate({
      where: {
        stockReleaseDetailId: detail.id,
        stockReturn: { status: TransactionStatus.COMPLETED },
      },
      _sum: { returnQuantity: true },
    })
    const completedReturnedQuantity = returned._sum.returnQuantity ?? 0
    const remainingReturnableQuantity = detail.releasedQuantity - completedReturnedQuantity
    if (remainingReturnableQuantity <= 0) continue
    details.push({
      stockReleaseDetailId: detail.id.toString(),
      deviceDetailId: detail.deviceDetailId.toString(),
      sourceRackId: detail.rackId.toString(),
      releasedQuantity: detail.releasedQuantity,
      completedReturnedQuantity,
      remainingReturnableQuantity,
      deviceDetail: {
        id: detail.deviceDetail.id.toString(),
        deviceId: detail.deviceDetail.deviceId.toString(),
        partNumber: detail.deviceDetail.partNumber,
        dpn: detail.deviceDetail.dpn,
        specification: detail.deviceDetail.specification,
        isActive: detail.deviceDetail.isActive,
        device: {
          id: detail.deviceDetail.device.id.toString(),
          deviceName: detail.deviceDetail.device.deviceName,
          isActive: detail.deviceDetail.device.isActive,
        },
      },
      sourceRack: {
        id: detail.rack.id.toString(),
        rackCode: detail.rack.rackCode,
        rackName: detail.rack.rackName,
        isActive: detail.rack.isActive,
      },
    })
  }

  return {
    id: record.id.toString(),
    transactionNumber: record.transactionNumber,
    releaseDate: record.releaseDate.toISOString().slice(0, 10),
    engineerName: record.engineerName,
    customerId: record.customerId.toString(),
    customer: {
      id: record.customer.id.toString(),
      customerName: record.customer.customerName,
      isActive: record.customer.isActive,
    },
    details,
  }
}
