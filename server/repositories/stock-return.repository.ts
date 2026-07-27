import type { Prisma, TransactionStatus } from '../../generated/prisma/client'
import { prisma } from '../utils/prisma'
import { stockReleaseInclude, type StockReleaseRecord } from './stock-release.repository'

export const stockReturnInclude = {
  stockRelease: {
    include: {
      customer: {
        select: {
          id: true,
          customerName: true,
          isActive: true,
        },
      },
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
      stockReleaseDetail: {
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
      },
      destinationRack: true,
    },
    orderBy: {
      id: 'asc' as const,
    },
  },
} satisfies Prisma.StockReturnInclude

export type StockReturnRecord = Prisma.StockReturnGetPayload<{
  include: typeof stockReturnInclude
}>

export interface StockReturnState {
  id: bigint
  transactionNumber: string
  returnDate: Date
  stockReleaseId: bigint
  notes: string | null
  status: TransactionStatus
  details: Array<{
    id: bigint
    stockReleaseDetailId: bigint
    destinationRackId: bigint
    returnQuantity: number
    notes: string | null
  }>
}

export interface StockReturnDetailWrite {
  stockReleaseDetailId: bigint
  destinationRackId: bigint
  returnQuantity: number
  notes: string | null
}

interface StockReturnDraftWrite {
  transactionNumber: string
  returnDate: Date
  stockReleaseId: bigint
  notes: string | null
  createdById: bigint
  details: StockReturnDetailWrite[]
}

interface StockReturnDraftReplacement {
  returnDate: Date
  stockReleaseId: bigint
  notes: string | null
  details: StockReturnDetailWrite[]
}

export interface StockReturnListArguments {
  where: Prisma.StockReturnWhereInput
  skip: number
  take: number
}

type StockReturnReadClient = Pick<Prisma.TransactionClient, 'stockReturn'>

export async function listStockReturnRecords({
  where,
  skip,
  take,
}: StockReturnListArguments): Promise<{ data: StockReturnRecord[]; total: number }> {
  const [data, total] = await Promise.all([
    prisma.stockReturn.findMany({
      where,
      include: stockReturnInclude,
      orderBy: [{ returnDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.stockReturn.count({ where }),
  ])
  return { data, total }
}

export function findStockReturnRecord(
  client: StockReturnReadClient,
  id: bigint,
): Promise<StockReturnRecord | null> {
  return client.stockReturn.findUnique({
    where: { id },
    include: stockReturnInclude,
  })
}

export async function findStockReturnState(
  tx: Prisma.TransactionClient,
  id: bigint,
): Promise<StockReturnState | null> {
  const header = await tx.stockReturn.findUnique({
    where: { id },
    select: {
      id: true,
      transactionNumber: true,
      returnDate: true,
      stockReleaseId: true,
      notes: true,
      status: true,
    },
  })
  if (!header) return null

  const details = await tx.stockReturnDetail.findMany({
    where: { stockReturnId: id },
    select: {
      id: true,
      stockReleaseDetailId: true,
      destinationRackId: true,
      returnQuantity: true,
      notes: true,
    },
    orderBy: { id: 'asc' },
  })
  return { ...header, details }
}

export async function createStockReturnRecord(
  tx: Prisma.TransactionClient,
  data: StockReturnDraftWrite,
): Promise<bigint> {
  const record = await tx.stockReturn.create({
    data: {
      transactionNumber: data.transactionNumber,
      returnDate: data.returnDate,
      stockReleaseId: data.stockReleaseId,
      notes: data.notes,
      createdById: data.createdById,
    },
    select: { id: true },
  })
  await tx.stockReturnDetail.createMany({
    data: data.details.map((detail) => ({
      stockReturnId: record.id,
      ...detail,
    })),
  })
  return record.id
}

export async function replaceStockReturnDraft(
  tx: Prisma.TransactionClient,
  id: bigint,
  data: StockReturnDraftReplacement,
): Promise<void> {
  await tx.stockReturnDetail.deleteMany({ where: { stockReturnId: id } })
  await tx.stockReturn.update({
    where: { id },
    data: {
      returnDate: data.returnDate,
      stockReleaseId: data.stockReleaseId,
      notes: data.notes,
    },
  })
  await tx.stockReturnDetail.createMany({
    data: data.details.map((detail) => ({
      stockReturnId: id,
      ...detail,
    })),
  })
}

export async function transitionStockReturnStatus(
  tx: Prisma.TransactionClient,
  id: bigint,
  from: TransactionStatus,
  to: TransactionStatus,
): Promise<boolean> {
  const result = await tx.stockReturn.updateMany({
    where: { id, status: from },
    data: { status: to },
  })
  return result.count === 1
}

export function findEligibleStockReleaseCandidates(
  where: Prisma.StockReleaseWhereInput,
): Promise<StockReleaseRecord[]> {
  return prisma.stockRelease.findMany({
    where,
    include: stockReleaseInclude,
    orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })
}
