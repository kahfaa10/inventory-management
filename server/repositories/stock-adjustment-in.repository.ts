import type { Prisma, TransactionStatus } from '../../generated/prisma/client'
import { prisma } from '../utils/prisma'

export const stockAdjustmentInInclude = {
  customer: {
    select: {
      id: true,
      customerName: true,
      isActive: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      displayName: true,
    },
  },
  details: {
    include: {
      deviceDetail: {
        include: {
          device: {
            select: {
              id: true,
              deviceName: true,
              isActive: true,
            },
          },
        },
      },
      rack: true,
    },
    orderBy: {
      id: 'asc' as const,
    },
  },
} satisfies Prisma.StockAdjustmentInInclude

export type StockAdjustmentInRecord = Prisma.StockAdjustmentInGetPayload<{
  include: typeof stockAdjustmentInInclude
}>

export interface StockAdjustmentInState {
  id: bigint
  transactionNumber: string
  transactionDate: Date
  customerId: bigint | null
  notes: string | null
  status: TransactionStatus
  details: Array<{
    id: bigint
    deviceDetailId: bigint
    rackId: bigint
    quantity: number
    notes: string | null
  }>
}

export interface StockAdjustmentDetailWrite {
  deviceDetailId: bigint
  rackId: bigint
  quantity: number
  notes: string | null
}

interface StockAdjustmentDraftWrite {
  transactionNumber: string
  transactionDate: Date
  customerId: bigint | null
  notes: string | null
  createdById: bigint
  details: StockAdjustmentDetailWrite[]
}

interface StockAdjustmentDraftReplacement {
  transactionDate: Date
  customerId: bigint | null
  notes: string | null
  details: StockAdjustmentDetailWrite[]
}

export interface StockAdjustmentListArguments {
  where: Prisma.StockAdjustmentInWhereInput
  skip: number
  take: number
}

type StockAdjustmentInReadClient = Pick<Prisma.TransactionClient, 'stockAdjustmentIn'>

export async function listStockAdjustmentInRecords({
  where,
  skip,
  take,
}: StockAdjustmentListArguments): Promise<{
  data: StockAdjustmentInRecord[]
  total: number
}> {
  const [data, total] = await Promise.all([
    prisma.stockAdjustmentIn.findMany({
      where,
      include: stockAdjustmentInInclude,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.stockAdjustmentIn.count({ where }),
  ])

  return { data, total }
}

export function findStockAdjustmentInRecord(
  client: StockAdjustmentInReadClient,
  id: bigint,
): Promise<StockAdjustmentInRecord | null> {
  return client.stockAdjustmentIn.findUnique({
    where: { id },
    include: stockAdjustmentInInclude,
  })
}

export async function findStockAdjustmentInState(
  tx: Prisma.TransactionClient,
  id: bigint,
): Promise<StockAdjustmentInState | null> {
  const header = await tx.stockAdjustmentIn.findUnique({
    where: { id },
    select: {
      id: true,
      transactionNumber: true,
      transactionDate: true,
      customerId: true,
      notes: true,
      status: true,
    },
  })
  if (!header) return null

  const details = await tx.stockAdjustmentInDetail.findMany({
    where: { stockAdjustmentInId: id },
    select: {
      id: true,
      deviceDetailId: true,
      rackId: true,
      quantity: true,
      notes: true,
    },
    orderBy: { id: 'asc' },
  })
  return { ...header, details }
}

export async function createStockAdjustmentInRecord(
  tx: Prisma.TransactionClient,
  data: StockAdjustmentDraftWrite,
): Promise<bigint> {
  const record = await tx.stockAdjustmentIn.create({
    data: {
      transactionNumber: data.transactionNumber,
      transactionDate: data.transactionDate,
      customerId: data.customerId,
      notes: data.notes,
      createdById: data.createdById,
    },
    select: { id: true },
  })
  await tx.stockAdjustmentInDetail.createMany({
    data: data.details.map((detail) => ({
      stockAdjustmentInId: record.id,
      ...detail,
    })),
  })
  return record.id
}

export async function replaceStockAdjustmentInDraft(
  tx: Prisma.TransactionClient,
  id: bigint,
  data: StockAdjustmentDraftReplacement,
): Promise<void> {
  await tx.stockAdjustmentInDetail.deleteMany({
    where: { stockAdjustmentInId: id },
  })
  await tx.stockAdjustmentIn.update({
    where: { id },
    data: {
      transactionDate: data.transactionDate,
      customerId: data.customerId,
      notes: data.notes,
    },
  })
  await tx.stockAdjustmentInDetail.createMany({
    data: data.details.map((detail) => ({
      stockAdjustmentInId: id,
      ...detail,
    })),
  })
}

export async function transitionStockAdjustmentInStatus(
  tx: Prisma.TransactionClient,
  id: bigint,
  from: TransactionStatus,
  to: TransactionStatus,
): Promise<boolean> {
  const result = await tx.stockAdjustmentIn.updateMany({
    where: { id, status: from },
    data: { status: to },
  })
  return result.count === 1
}
