import {
  MovementPurpose,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client'
import {
  eligibleStockReleaseListQuerySchema,
  stockReturnCreateSchema,
  stockReturnListQuerySchema,
  stockReturnUpdateSchema,
  type EligibleStockReleaseListQueryInput,
  type StockReturnCreate,
  type StockReturnCreateInput,
  type StockReturnListQueryInput,
  type StockReturnUpdateInput,
} from '../../shared/schemas/stock-return'
import type { PaginatedResponse } from '../../shared/types/api'
import type {
  StockReleaseReturnableDto,
  StockReturnDetailDto,
  StockReturnDto,
} from '../../shared/types/transactions'
import {
  createStockReturnRecord,
  findEligibleStockReleasePage,
  findStockReturnRecord,
  findStockReturnState,
  listStockReturnRecords,
  replaceStockReturnDraft,
  transitionStockReturnStatus,
  type StockReturnDetailWrite,
  type StockReturnRecord,
  type StockReturnState,
} from '../repositories/stock-return.repository'
import type { StockReleaseRecord } from '../repositories/stock-release.repository'
import { ApiError } from '../utils/api-error'
import { inactiveMasterError, notFoundError } from '../utils/prisma-errors'
import { prisma } from '../utils/prisma'
import { lockStockKeys, lockStockReleaseDetailRows } from '../utils/stock-lock'
import { runInventoryTransaction } from '../utils/transaction'
import { parseBody, parseQuery } from '../utils/validation'
import { reverseInboundStockMovements } from './cancellation.service'
import { nextTransactionNumber } from './transaction-number.service'

type ActorId = bigint | string
type ReturnQuantityClient = Pick<Prisma.TransactionClient, 'stockReturnDetail'>

interface ReturnableQuantity {
  releasedQuantity: number
  completedReturnedQuantity: number
  remainingReturnableQuantity: number
}

function runReturnReadSnapshot<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(operation, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  })
}

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

function returnDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function invalidState(message: string): ApiError {
  return new ApiError(409, 'INVALID_TRANSACTION_STATE', message)
}

function excessiveReturnError(
  remainingQuantity: number,
  detailIndexes: readonly number[],
): ApiError {
  const message = `Return quantity cannot exceed remaining returnable quantity. Remaining returnable quantity: ${remainingQuantity}.`
  return new ApiError(
    409,
    'RETURN_QUANTITY_EXCEEDED',
    message,
    Object.fromEntries(
      detailIndexes.map((index) => [`details.${index}.returnQuantity`, [message]]),
    ),
  )
}

function detailWrites(value: StockReturnCreate): StockReturnDetailWrite[] {
  return value.details.map((detail) => ({
    stockReleaseDetailId: BigInt(detail.stockReleaseDetailId),
    destinationRackId: BigInt(detail.destinationRackId),
    returnQuantity: detail.returnQuantity,
    notes: detail.notes,
  }))
}

function recordAsValidationValue(record: StockReturnState): StockReturnCreate {
  return {
    returnDate: record.returnDate.toISOString().slice(0, 10),
    stockReleaseId: record.stockReleaseId.toString(),
    notes: record.notes,
    details: record.details.map((detail) => ({
      stockReleaseDetailId: detail.stockReleaseDetailId.toString(),
      destinationRackId: detail.destinationRackId.toString(),
      returnQuantity: detail.returnQuantity,
      notes: detail.notes,
    })),
  }
}

async function lockReturnHeader(tx: Prisma.TransactionClient, id: bigint): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT "id"
    FROM "stock_returns"
    WHERE "id" = ${id}
    FOR UPDATE
  `)
}

async function requireReturn(tx: Prisma.TransactionClient, id: bigint): Promise<StockReturnState> {
  const record = await findStockReturnState(tx, id)
  if (!record) throw notFoundError()
  return record
}

interface AggregatedReturn {
  stockReleaseDetailId: bigint
  quantity: number
  detailIndexes: number[]
}

function aggregateReturnDetails(
  details: readonly {
    stockReleaseDetailId: bigint
    returnQuantity: number
  }[],
): AggregatedReturn[] {
  const aggregates = new Map<bigint, AggregatedReturn>()
  details.forEach((detail, index) => {
    const aggregate = aggregates.get(detail.stockReleaseDetailId)
    if (aggregate) {
      aggregate.quantity += detail.returnQuantity
      aggregate.detailIndexes.push(index)
    } else {
      aggregates.set(detail.stockReleaseDetailId, {
        stockReleaseDetailId: detail.stockReleaseDetailId,
        quantity: detail.returnQuantity,
        detailIndexes: [index],
      })
    }
  })
  return [...aggregates.values()]
}

export async function getReturnableQuantities(
  client: ReturnQuantityClient,
  releaseDetails: readonly { id: bigint; releasedQuantity: number }[],
): Promise<Map<bigint, ReturnableQuantity>> {
  const uniqueDetails = new Map(releaseDetails.map((detail) => [detail.id, detail]))
  if (uniqueDetails.size === 0) return new Map()

  const completed = await client.stockReturnDetail.groupBy({
    by: ['stockReleaseDetailId'],
    where: {
      stockReleaseDetailId: { in: [...uniqueDetails.keys()] },
      stockReturn: { status: TransactionStatus.COMPLETED },
    },
    _sum: { returnQuantity: true },
  })
  const completedByDetail = new Map(
    completed.map((row) => [row.stockReleaseDetailId, row._sum.returnQuantity ?? 0]),
  )

  return new Map(
    [...uniqueDetails].map(([id, detail]) => {
      const completedReturnedQuantity = completedByDetail.get(id) ?? 0
      return [
        id,
        {
          releasedQuantity: detail.releasedQuantity,
          completedReturnedQuantity,
          remainingReturnableQuantity: detail.releasedQuantity - completedReturnedQuantity,
        },
      ]
    }),
  )
}

async function validateReturn(
  tx: Prisma.TransactionClient,
  value: StockReturnCreate,
  validateQuantities: boolean,
): Promise<{
  release: {
    id: bigint
    transactionNumber: string
    releaseDate: Date
    engineerName: string
    customerId: bigint
    status: TransactionStatus
  }
  releaseDetails: Array<{
    id: bigint
    deviceDetailId: bigint
    rackId: bigint
    releasedQuantity: number
  }>
}> {
  const releaseId = BigInt(value.stockReleaseId)
  const release = await tx.stockRelease.findUnique({
    where: { id: releaseId },
    select: {
      id: true,
      transactionNumber: true,
      releaseDate: true,
      engineerName: true,
      customerId: true,
      status: true,
    },
  })
  if (!release) throw notFoundError()
  if (release.status !== TransactionStatus.COMPLETED) {
    throw invalidState('Only Completed Stock Releases may be returned.')
  }

  const releaseDetailIds = [
    ...new Set(value.details.map(({ stockReleaseDetailId }) => BigInt(stockReleaseDetailId))),
  ]
  const releaseDetails = await tx.stockReleaseDetail.findMany({
    where: {
      id: { in: releaseDetailIds },
      stockReleaseId: release.id,
    },
    select: {
      id: true,
      deviceDetailId: true,
      rackId: true,
      releasedQuantity: true,
    },
    orderBy: { id: 'asc' },
  })
  if (releaseDetails.length !== releaseDetailIds.length) {
    throw new ApiError(
      422,
      'RELEASE_DETAIL_MISMATCH',
      'Released item must belong to the selected Stock Release.',
    )
  }

  const destinationRackIds = [
    ...new Set(value.details.map(({ destinationRackId }) => BigInt(destinationRackId))),
  ]
  const racks = await tx.rack.findMany({
    where: { id: { in: destinationRackIds } },
    select: { id: true, isActive: true },
  })
  if (racks.length !== destinationRackIds.length) throw notFoundError()
  if (racks.some((rack) => !rack.isActive)) throw inactiveMasterError()

  if (validateQuantities) {
    const returnable = await getReturnableQuantities(tx, releaseDetails)
    for (const aggregate of aggregateReturnDetails(
      value.details.map((detail) => ({
        stockReleaseDetailId: BigInt(detail.stockReleaseDetailId),
        returnQuantity: detail.returnQuantity,
      })),
    )) {
      const remaining = returnable.get(aggregate.stockReleaseDetailId)?.remainingReturnableQuantity
      if (remaining === undefined) throw notFoundError()
      if (aggregate.quantity > remaining) {
        throw excessiveReturnError(Math.max(remaining, 0), aggregate.detailIndexes)
      }
    }
  }

  return { release, releaseDetails }
}

async function returnDtos(
  client: ReturnQuantityClient,
  records: readonly StockReturnRecord[],
): Promise<StockReturnDto[]> {
  const releaseDetails = records.flatMap((record) =>
    record.details.map(({ stockReleaseDetail }) => ({
      id: stockReleaseDetail.id,
      releasedQuantity: stockReleaseDetail.releasedQuantity,
    })),
  )
  const quantities = await getReturnableQuantities(client, releaseDetails)

  return records.map((record) => {
    const currentByReleaseDetail = new Map<bigint, number>()
    if (record.status === TransactionStatus.COMPLETED) {
      for (const detail of record.details) {
        currentByReleaseDetail.set(
          detail.stockReleaseDetailId,
          (currentByReleaseDetail.get(detail.stockReleaseDetailId) ?? 0) + detail.returnQuantity,
        )
      }
    }

    const details: StockReturnDetailDto[] = record.details.map((detail) => {
      const releaseDetail = detail.stockReleaseDetail
      const quantity = quantities.get(releaseDetail.id) ?? {
        releasedQuantity: releaseDetail.releasedQuantity,
        completedReturnedQuantity: 0,
        remainingReturnableQuantity: releaseDetail.releasedQuantity,
      }
      return {
        id: detail.id.toString(),
        stockReleaseDetailId: detail.stockReleaseDetailId.toString(),
        destinationRackId: detail.destinationRackId.toString(),
        releasedQuantity: releaseDetail.releasedQuantity,
        previouslyReturnedQuantity:
          quantity.completedReturnedQuantity -
          (currentByReleaseDetail.get(detail.stockReleaseDetailId) ?? 0),
        remainingReturnableQuantity: quantity.remainingReturnableQuantity,
        returnQuantity: detail.returnQuantity,
        notes: detail.notes,
        deviceDetail: {
          id: releaseDetail.deviceDetail.id.toString(),
          deviceId: releaseDetail.deviceDetail.deviceId.toString(),
          partNumber: releaseDetail.deviceDetail.partNumber,
          dpn: releaseDetail.deviceDetail.dpn,
          specification: releaseDetail.deviceDetail.specification,
          isActive: releaseDetail.deviceDetail.isActive,
          device: {
            id: releaseDetail.deviceDetail.device.id.toString(),
            deviceName: releaseDetail.deviceDetail.device.deviceName,
            isActive: releaseDetail.deviceDetail.device.isActive,
          },
        },
        sourceRack: {
          id: releaseDetail.rack.id.toString(),
          rackCode: releaseDetail.rack.rackCode,
          rackName: releaseDetail.rack.rackName,
          isActive: releaseDetail.rack.isActive,
        },
        destinationRack: {
          id: detail.destinationRack.id.toString(),
          rackCode: detail.destinationRack.rackCode,
          rackName: detail.destinationRack.rackName,
          isActive: detail.destinationRack.isActive,
        },
        createdAt: detail.createdAt.toISOString(),
        updatedAt: detail.updatedAt.toISOString(),
      }
    })

    return {
      id: record.id.toString(),
      transactionNumber: record.transactionNumber,
      returnDate: record.returnDate.toISOString().slice(0, 10),
      stockReleaseId: record.stockReleaseId.toString(),
      stockRelease: {
        id: record.stockRelease.id.toString(),
        transactionNumber: record.stockRelease.transactionNumber,
        releaseDate: record.stockRelease.releaseDate.toISOString().slice(0, 10),
        engineerName: record.stockRelease.engineerName,
        customerId: record.stockRelease.customerId.toString(),
        customer: {
          id: record.stockRelease.customer.id.toString(),
          customerName: record.stockRelease.customer.customerName,
          isActive: record.stockRelease.customer.isActive,
        },
      },
      engineerName: record.stockRelease.engineerName,
      customerId: record.stockRelease.customerId.toString(),
      customer: {
        id: record.stockRelease.customer.id.toString(),
        customerName: record.stockRelease.customer.customerName,
        isActive: record.stockRelease.customer.isActive,
      },
      notes: record.notes,
      status: record.status,
      createdById: record.createdById.toString(),
      createdBy: {
        id: record.createdBy.id.toString(),
        displayName: record.createdBy.displayName,
      },
      details,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  })
}

export async function listStockReturns(
  query: StockReturnListQueryInput = {},
): Promise<PaginatedResponse<StockReturnDto>> {
  const value = parseQuery(stockReturnListQuerySchema, query)
  const where: Prisma.StockReturnWhereInput = {
    ...(value.search
      ? {
          OR: [
            { transactionNumber: { contains: value.search, mode: 'insensitive' as const } },
            {
              stockRelease: {
                transactionNumber: { contains: value.search, mode: 'insensitive' as const },
              },
            },
            {
              stockRelease: {
                engineerName: { contains: value.search, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {}),
    ...(value.status ? { status: value.status } : {}),
    ...(value.stockReleaseId ? { stockReleaseId: BigInt(value.stockReleaseId) } : {}),
    ...(value.customerId ? { stockRelease: { customerId: BigInt(value.customerId) } } : {}),
    ...(value.dateFrom || value.dateTo
      ? {
          returnDate: {
            ...(value.dateFrom ? { gte: returnDate(value.dateFrom) } : {}),
            ...(value.dateTo ? { lte: returnDate(value.dateTo) } : {}),
          },
        }
      : {}),
  }
  return runReturnReadSnapshot(async (tx) => {
    const result = await listStockReturnRecords(tx, {
      where,
      skip: (value.page - 1) * value.pageSize,
      take: value.pageSize,
    })
    return {
      data: await returnDtos(tx, result.data),
      page: value.page,
      pageSize: value.pageSize,
      total: result.total,
    }
  })
}

export async function getStockReturn(id: string): Promise<StockReturnDto> {
  const stockReturnId = positiveBigInt(id, 'Transaction ID')
  return runReturnReadSnapshot(async (tx) => {
    const record = await findStockReturnRecord(tx, stockReturnId)
    if (!record) throw notFoundError()
    return (await returnDtos(tx, [record]))[0]!
  })
}

export async function createStockReturn(
  actorId: ActorId,
  input: StockReturnCreateInput,
): Promise<StockReturnDto> {
  const actor = positiveBigInt(actorId, 'Actor ID')
  const value = parseBody(stockReturnCreateSchema, input)
  const id = await runInventoryTransaction(async (tx) => {
    await validateReturn(tx, value, true)
    const date = returnDate(value.returnDate)
    const number = await nextTransactionNumber(tx, TransactionType.STOCK_RETURN, date)
    return createStockReturnRecord(tx, {
      transactionNumber: number,
      returnDate: date,
      stockReleaseId: BigInt(value.stockReleaseId),
      notes: value.notes,
      createdById: actor,
      details: detailWrites(value),
    })
  })
  return getStockReturn(id.toString())
}

export async function updateStockReturn(
  actorId: ActorId,
  id: string,
  input: StockReturnUpdateInput,
): Promise<StockReturnDto> {
  positiveBigInt(actorId, 'Actor ID')
  const stockReturnId = positiveBigInt(id, 'Transaction ID')
  const value = parseBody(stockReturnUpdateSchema, input)
  await runInventoryTransaction(async (tx) => {
    await lockReturnHeader(tx, stockReturnId)
    const current = await requireReturn(tx, stockReturnId)
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Only Draft Stock Returns may be updated.')
    }
    await validateReturn(tx, value, true)
    await replaceStockReturnDraft(tx, stockReturnId, {
      returnDate: returnDate(value.returnDate),
      stockReleaseId: BigInt(value.stockReleaseId),
      notes: value.notes,
      details: detailWrites(value),
    })
  })
  return getStockReturn(stockReturnId.toString())
}

export async function completeStockReturn(id: string, actorId: ActorId): Promise<StockReturnDto> {
  const stockReturnId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')
  await runInventoryTransaction(async (tx) => {
    await lockReturnHeader(tx, stockReturnId)
    let current = await requireReturn(tx, stockReturnId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled Stock Returns cannot be completed.')
    }
    if (current.details.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'At least one transaction detail is required.')
    }

    await lockStockReleaseDetailRows(tx, current.stockReleaseId)
    current = await requireReturn(tx, stockReturnId)
    if (current.status === TransactionStatus.COMPLETED) return
    if (current.status !== TransactionStatus.DRAFT) {
      throw invalidState('Cancelled Stock Returns cannot be completed.')
    }
    const { release, releaseDetails } = await validateReturn(
      tx,
      recordAsValidationValue(current),
      true,
    )
    const releaseDetailById = new Map(releaseDetails.map((detail) => [detail.id, detail]))
    await lockStockKeys(
      tx,
      current.details.map((detail) => ({
        deviceDetailId: releaseDetailById.get(detail.stockReleaseDetailId)!.deviceDetailId,
        rackId: detail.destinationRackId,
      })),
    )

    await tx.stockMovement.createMany({
      data: current.details.map((detail) => ({
        deviceDetailId: releaseDetailById.get(detail.stockReleaseDetailId)!.deviceDetailId,
        rackId: detail.destinationRackId,
        customerId: release.customerId,
        transactionType: TransactionType.STOCK_RETURN,
        transactionId: current.id,
        transactionDetailId: detail.id,
        transactionNumber: current.transactionNumber,
        transactionDate: current.returnDate,
        engineerName: release.engineerName,
        quantityIn: detail.returnQuantity,
        quantityOut: 0,
        movementPurpose: MovementPurpose.ORIGINAL,
        createdById: actor,
      })),
    })
    if (
      !(await transitionStockReturnStatus(
        tx,
        stockReturnId,
        TransactionStatus.DRAFT,
        TransactionStatus.COMPLETED,
      ))
    ) {
      throw invalidState('Stock Return was changed by another request.')
    }
  })
  return getStockReturn(stockReturnId.toString())
}

export async function cancelStockReturn(id: string, actorId: ActorId): Promise<StockReturnDto> {
  const stockReturnId = positiveBigInt(id, 'Transaction ID')
  const actor = positiveBigInt(actorId, 'Actor ID')
  await runInventoryTransaction(async (tx) => {
    await lockReturnHeader(tx, stockReturnId)
    const current = await requireReturn(tx, stockReturnId)
    if (current.status === TransactionStatus.CANCELLED) return
    if (current.status === TransactionStatus.DRAFT) {
      if (
        !(await transitionStockReturnStatus(
          tx,
          stockReturnId,
          TransactionStatus.DRAFT,
          TransactionStatus.CANCELLED,
        ))
      ) {
        throw invalidState('Stock Return was changed by another request.')
      }
      return
    }

    await lockStockReleaseDetailRows(tx, current.stockReleaseId)
    const release = await tx.stockRelease.findUnique({
      where: { id: current.stockReleaseId },
      select: {
        transactionNumber: true,
        releaseDate: true,
        engineerName: true,
        customerId: true,
        details: {
          select: { id: true, deviceDetailId: true },
        },
      },
    })
    if (!release) throw notFoundError()
    const originals = await tx.stockMovement.findMany({
      where: {
        transactionType: TransactionType.STOCK_RETURN,
        transactionId: stockReturnId,
        movementPurpose: MovementPurpose.ORIGINAL,
      },
      orderBy: { id: 'asc' },
    })
    const releaseDetailsById = new Map(release.details.map((detail) => [detail.id, detail]))
    const currentDetailsById = new Map(current.details.map((detail) => [detail.id, detail]))
    const invalidOriginal =
      originals.length !== current.details.length ||
      originals.some((original) => {
        const detail = currentDetailsById.get(original.transactionDetailId)
        const releaseDetail = detail
          ? releaseDetailsById.get(detail.stockReleaseDetailId)
          : undefined
        return (
          !detail ||
          !releaseDetail ||
          original.transactionNumber !== current.transactionNumber ||
          original.transactionDate.getTime() !== current.returnDate.getTime() ||
          original.customerId !== release.customerId ||
          original.engineerName !== release.engineerName ||
          original.deviceDetailId !== releaseDetail.deviceDetailId ||
          original.rackId !== detail.destinationRackId ||
          original.quantityIn !== detail.returnQuantity ||
          original.quantityOut !== 0
        )
      })
    if (invalidOriginal) {
      throw new ApiError(
        409,
        'INVALID_CANCELLATION_SOURCE',
        'Completed Stock Return movements are incomplete.',
      )
    }

    await reverseInboundStockMovements(tx, originals, actor)
    if (
      !(await transitionStockReturnStatus(
        tx,
        stockReturnId,
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
      ))
    ) {
      throw invalidState('Stock Return was changed by another request.')
    }
  })
  return getStockReturn(stockReturnId.toString())
}

function releaseReturnableDto(
  record: StockReleaseRecord,
  quantities: ReadonlyMap<bigint, ReturnableQuantity>,
): StockReleaseReturnableDto {
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
    details: record.details.flatMap((detail) => {
      const quantity = quantities.get(detail.id)
      if (!quantity || quantity.remainingReturnableQuantity <= 0) return []
      return [
        {
          stockReleaseDetailId: detail.id.toString(),
          deviceDetailId: detail.deviceDetailId.toString(),
          sourceRackId: detail.rackId.toString(),
          ...quantity,
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
        },
      ]
    }),
  }
}

export async function listEligibleStockReleases(
  query: EligibleStockReleaseListQueryInput = {},
): Promise<PaginatedResponse<StockReleaseReturnableDto>> {
  const value = parseQuery(eligibleStockReleaseListQuerySchema, query)
  return runReturnReadSnapshot(async (tx) => {
    const page = await findEligibleStockReleasePage(tx, {
      search: value.search,
      customerId: value.customerId ? BigInt(value.customerId) : undefined,
      skip: (value.page - 1) * value.pageSize,
      take: value.pageSize,
    })
    const quantities = await getReturnableQuantities(
      tx,
      page.data.flatMap((record) =>
        record.details.map(({ id, releasedQuantity }) => ({ id, releasedQuantity })),
      ),
    )
    return {
      data: page.data.map((record) => releaseReturnableDto(record, quantities)),
      page: value.page,
      pageSize: value.pageSize,
      total: page.total,
    }
  })
}
