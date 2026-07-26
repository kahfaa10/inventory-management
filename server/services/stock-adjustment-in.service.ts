import {
  MovementPurpose,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client'
import {
  stockAdjustmentInCreateSchema,
  stockAdjustmentInListQuerySchema,
  stockAdjustmentInUpdateSchema,
  type StockAdjustmentInCreate,
  type StockAdjustmentInCreateInput,
  type StockAdjustmentInListQueryInput,
  type StockAdjustmentInUpdateInput,
} from '../../shared/schemas/stock-adjustment-in'
import type { PaginatedResponse } from '../../shared/types/api'
import type {
  StockAdjustmentInDetailDto,
  StockAdjustmentInDto,
} from '../../shared/types/transactions'
import {
  createStockAdjustmentInRecord,
  findStockAdjustmentInRecord,
  findStockAdjustmentInState,
  listStockAdjustmentInRecords,
  replaceStockAdjustmentInDraft,
  transitionStockAdjustmentInStatus,
  type StockAdjustmentDetailWrite,
  type StockAdjustmentInRecord,
  type StockAdjustmentInState,
} from '../repositories/stock-adjustment-in.repository'
import { ApiError } from '../utils/api-error'
import { inactiveMasterError, notFoundError } from '../utils/prisma-errors'
import { prisma } from '../utils/prisma'
import { lockStockKeys } from '../utils/stock-lock'
import { runInventoryTransaction } from '../utils/transaction'
import { parseBody, parseQuery } from '../utils/validation'
import { reverseInboundStockMovements } from './cancellation.service'
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

function transactionDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function invalidState(message: string): ApiError {
  return new ApiError(409, 'INVALID_TRANSACTION_STATE', message)
}

function detailDto(detail: StockAdjustmentInRecord['details'][number]): StockAdjustmentInDetailDto {
  return {
    id: detail.id.toString(),
    deviceDetailId: detail.deviceDetailId.toString(),
    destinationRackId: detail.rackId.toString(),
    quantity: detail.quantity,
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
    destinationRack: {
      id: detail.rack.id.toString(),
      rackCode: detail.rack.rackCode,
      rackName: detail.rack.rackName,
      isActive: detail.rack.isActive,
    },
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
  }
}

function adjustmentDto(record: StockAdjustmentInRecord): StockAdjustmentInDto {
  return {
    id: record.id.toString(),
    transactionNumber: record.transactionNumber,
    transactionDate: record.transactionDate.toISOString().slice(0, 10),
    customerId: record.customerId?.toString() ?? null,
    customer: record.customer
      ? {
          id: record.customer.id.toString(),
          customerName: record.customer.customerName,
          isActive: record.customer.isActive,
        }
      : null,
    notes: record.notes,
    status: record.status,
    createdById: record.createdById.toString(),
    createdBy: {
      id: record.createdBy.id.toString(),
      displayName: record.createdBy.displayName,
    },
    details: record.details.map(detailDto),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function detailWrites(value: StockAdjustmentInCreate): StockAdjustmentDetailWrite[] {
  return value.details.map((detail) => ({
    deviceDetailId: BigInt(detail.deviceDetailId),
    rackId: BigInt(detail.destinationRackId),
    quantity: detail.quantity,
    notes: detail.notes,
  }))
}

async function validateActiveMasters(
  tx: Prisma.TransactionClient,
  value: StockAdjustmentInCreate,
): Promise<void> {
  if (value.customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: BigInt(value.customerId) },
      select: { isActive: true },
    })
    if (!customer) throw notFoundError()
    if (!customer.isActive) throw inactiveMasterError()
  }

  const deviceDetailIds = [
    ...new Set(value.details.map(({ deviceDetailId }) => deviceDetailId)),
  ].map(BigInt)
  const rackIds = [...new Set(value.details.map(({ destinationRackId }) => destinationRackId))].map(
    BigInt,
  )
  const deviceDetails = await tx.deviceDetail.findMany({
    where: { id: { in: deviceDetailIds } },
    select: {
      id: true,
      deviceId: true,
      isActive: true,
    },
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

async function lockAdjustmentHeader(tx: Prisma.TransactionClient, id: bigint): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT "id"
    FROM "stock_adjustment_ins"
    WHERE "id" = ${id}
    FOR UPDATE
  `)
}

function recordAsValidationValue(record: StockAdjustmentInState): StockAdjustmentInCreate {
  return {
    transactionDate: record.transactionDate.toISOString().slice(0, 10),
    customerId: record.customerId?.toString() ?? null,
    notes: record.notes,
    details: record.details.map((detail) => ({
      deviceDetailId: detail.deviceDetailId.toString(),
      destinationRackId: detail.rackId.toString(),
      quantity: detail.quantity,
      notes: detail.notes,
    })),
  }
}

async function requireAdjustment(
  tx: Prisma.TransactionClient,
  id: bigint,
): Promise<StockAdjustmentInState> {
  const record = await findStockAdjustmentInState(tx, id)
  if (!record) throw notFoundError()
  return record
}

export async function listStockAdjustmentIns(
  query: StockAdjustmentInListQueryInput = {},
): Promise<PaginatedResponse<StockAdjustmentInDto>> {
  const value = parseQuery(stockAdjustmentInListQuerySchema, query)
  const where: Prisma.StockAdjustmentInWhereInput = {
    ...(value.search
      ? {
          transactionNumber: {
            contains: value.search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(value.status ? { status: value.status } : {}),
    ...(value.customerId ? { customerId: BigInt(value.customerId) } : {}),
    ...(value.dateFrom || value.dateTo
      ? {
          transactionDate: {
            ...(value.dateFrom ? { gte: transactionDate(value.dateFrom) } : {}),
            ...(value.dateTo ? { lte: transactionDate(value.dateTo) } : {}),
          },
        }
      : {}),
  }
  const result = await listStockAdjustmentInRecords({
    where,
    skip: (value.page - 1) * value.pageSize,
    take: value.pageSize,
  })

  return {
    data: result.data.map(adjustmentDto),
    page: value.page,
    pageSize: value.pageSize,
    total: result.total,
  }
}

export async function getStockAdjustmentIn(id: string): Promise<StockAdjustmentInDto> {
  const record = await findStockAdjustmentInRecord(prisma, positiveBigInt(id, 'Transaction ID'))
  if (!record) throw notFoundError()
  return adjustmentDto(record)
}

export async function createStockAdjustmentIn(
  actorId: ActorId,
  input: StockAdjustmentInCreateInput,
): Promise<StockAdjustmentInDto> {
  const actor = positiveBigInt(actorId, 'Actor ID')
  const value = parseBody(stockAdjustmentInCreateSchema, input)

  const id = await runInventoryTransaction(async (tx) => {
    await validateActiveMasters(tx, value)
    const date = transactionDate(value.transactionDate)
    const number = await nextTransactionNumber(tx, TransactionType.STOCK_ADJUSTMENT_IN, date)
    return createStockAdjustmentInRecord(tx, {
      transactionNumber: number,
      transactionDate: date,
      customerId: value.customerId ? BigInt(value.customerId) : null,
      notes: value.notes,
      createdById: actor,
      details: detailWrites(value),
    })
  })

  return getStockAdjustmentIn(id.toString())
}

export async function updateStockAdjustmentIn(
  actorId: ActorId,
  id: string,
  input: StockAdjustmentInUpdateInput,
): Promise<StockAdjustmentInDto> {
  positiveBigInt(actorId, 'Actor ID')
  const adjustmentId = positiveBigInt(id, 'Transaction ID')
  const value = parseBody(stockAdjustmentInUpdateSchema, input)

  await runInventoryTransaction(async (tx) => {
    await lockAdjustmentHeader(tx, adjustmentId)
    const current = await requireAdjustment(tx, adjustmentId)
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Only Draft stock adjustments may be updated.')
    }
    await validateActiveMasters(tx, value)
    await replaceStockAdjustmentInDraft(tx, adjustmentId, {
      transactionDate: transactionDate(value.transactionDate),
      customerId: value.customerId ? BigInt(value.customerId) : null,
      notes: value.notes,
      details: detailWrites(value),
    })
  })

  return getStockAdjustmentIn(adjustmentId.toString())
}

export async function completeStockAdjustmentIn(
  id: string,
  actorId: ActorId,
): Promise<StockAdjustmentInDto> {
  const adjustmentId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')

  await runInventoryTransaction(async (tx) => {
    await lockAdjustmentHeader(tx, adjustmentId)
    let current = await requireAdjustment(tx, adjustmentId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled stock adjustments cannot be completed.')
    }
    if (current.details.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'At least one transaction detail is required.')
    }

    await lockStockKeys(
      tx,
      current.details.map((detail) => ({
        deviceDetailId: detail.deviceDetailId,
        rackId: detail.rackId,
      })),
    )

    current = await requireAdjustment(tx, adjustmentId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled stock adjustments cannot be completed.')
    }
    await validateActiveMasters(tx, recordAsValidationValue(current))

    await tx.stockMovement.createMany({
      data: current.details.map((detail) => ({
        deviceDetailId: detail.deviceDetailId,
        rackId: detail.rackId,
        customerId: current.customerId,
        transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
        transactionId: current.id,
        transactionDetailId: detail.id,
        transactionNumber: current.transactionNumber,
        transactionDate: current.transactionDate,
        quantityIn: detail.quantity,
        quantityOut: 0,
        movementPurpose: MovementPurpose.ORIGINAL,
        createdById: actor,
      })),
    })

    if (
      !(await transitionStockAdjustmentInStatus(
        tx,
        adjustmentId,
        TransactionStatus.DRAFT,
        TransactionStatus.COMPLETED,
      ))
    ) {
      throw invalidState('Stock adjustment was changed by another request.')
    }
  })

  return getStockAdjustmentIn(adjustmentId.toString())
}

export async function cancelStockAdjustmentIn(
  id: string,
  actorId: ActorId,
): Promise<StockAdjustmentInDto> {
  const adjustmentId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')

  await runInventoryTransaction(async (tx) => {
    await lockAdjustmentHeader(tx, adjustmentId)
    const current = await requireAdjustment(tx, adjustmentId)
    if (current.status === TransactionStatus.CANCELLED) return

    if (current.status === TransactionStatus.DRAFT) {
      if (
        !(await transitionStockAdjustmentInStatus(
          tx,
          adjustmentId,
          TransactionStatus.DRAFT,
          TransactionStatus.CANCELLED,
        ))
      ) {
        throw invalidState('Stock adjustment was changed by another request.')
      }
      return
    }

    const originals = await tx.stockMovement.findMany({
      where: {
        transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
        transactionId: adjustmentId,
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
          original.transactionDate.getTime() !== current.transactionDate.getTime() ||
          original.customerId !== current.customerId ||
          original.deviceDetailId !== detail.deviceDetailId ||
          original.rackId !== detail.rackId ||
          original.quantityIn !== detail.quantity ||
          original.quantityOut !== 0
        )
      })
    if (invalidOriginal) {
      throw new ApiError(
        409,
        'INVALID_CANCELLATION_SOURCE',
        'Completed stock adjustment movements are incomplete.',
      )
    }

    await reverseInboundStockMovements(tx, originals, actor)
    if (
      !(await transitionStockAdjustmentInStatus(
        tx,
        adjustmentId,
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
      ))
    ) {
      throw invalidState('Stock adjustment was changed by another request.')
    }
  })

  return getStockAdjustmentIn(adjustmentId.toString())
}
