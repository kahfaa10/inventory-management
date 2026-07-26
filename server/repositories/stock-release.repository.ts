import type { Prisma, TransactionStatus } from '../../generated/prisma/client'
import { prisma } from '../utils/prisma'

export const stockReleaseInclude = {
  customer: {
    select: {
      id: true,
      customerName: true,
      isActive: true,
    },
  },
  model: {
    select: {
      id: true,
      modelName: true,
      isActive: true,
    },
  },
  serviceTag: {
    select: {
      id: true,
      serviceTag: true,
      modelId: true,
      customerId: true,
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
} satisfies Prisma.StockReleaseInclude

export type StockReleaseRecord = Prisma.StockReleaseGetPayload<{
  include: typeof stockReleaseInclude
}>

export interface StockReleaseState {
  id: bigint
  transactionNumber: string
  releaseDate: Date
  engineerName: string
  customerId: bigint
  modelId: bigint | null
  serviceTagId: bigint | null
  referenceNumber: string | null
  notes: string | null
  status: TransactionStatus
  details: Array<{
    id: bigint
    deviceDetailId: bigint
    rackId: bigint
    releasedQuantity: number
    notes: string | null
  }>
}

export interface StockReleaseDetailWrite {
  deviceDetailId: bigint
  rackId: bigint
  releasedQuantity: number
  notes: string | null
}

interface StockReleaseDraftWrite {
  transactionNumber: string
  releaseDate: Date
  engineerName: string
  customerId: bigint
  modelId: bigint | null
  serviceTagId: bigint | null
  referenceNumber: string | null
  notes: string | null
  createdById: bigint
  details: StockReleaseDetailWrite[]
}

interface StockReleaseDraftReplacement {
  releaseDate: Date
  engineerName: string
  customerId: bigint
  modelId: bigint | null
  serviceTagId: bigint | null
  referenceNumber: string | null
  notes: string | null
  details: StockReleaseDetailWrite[]
}

export interface StockReleaseListArguments {
  where: Prisma.StockReleaseWhereInput
  skip: number
  take: number
}

type StockReleaseReadClient = Pick<Prisma.TransactionClient, 'stockRelease'>

export async function listStockReleaseRecords({
  where,
  skip,
  take,
}: StockReleaseListArguments): Promise<{
  data: StockReleaseRecord[]
  total: number
}> {
  const [data, total] = await Promise.all([
    prisma.stockRelease.findMany({
      where,
      include: stockReleaseInclude,
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.stockRelease.count({ where }),
  ])
  return { data, total }
}

export function findStockReleaseRecord(
  client: StockReleaseReadClient,
  id: bigint,
): Promise<StockReleaseRecord | null> {
  return client.stockRelease.findUnique({
    where: { id },
    include: stockReleaseInclude,
  })
}

export async function findStockReleaseState(
  tx: Prisma.TransactionClient,
  id: bigint,
): Promise<StockReleaseState | null> {
  const header = await tx.stockRelease.findUnique({
    where: { id },
    select: {
      id: true,
      transactionNumber: true,
      releaseDate: true,
      engineerName: true,
      customerId: true,
      modelId: true,
      serviceTagId: true,
      referenceNumber: true,
      notes: true,
      status: true,
    },
  })
  if (!header) return null

  const details = await tx.stockReleaseDetail.findMany({
    where: { stockReleaseId: id },
    select: {
      id: true,
      deviceDetailId: true,
      rackId: true,
      releasedQuantity: true,
      notes: true,
    },
    orderBy: { id: 'asc' },
  })
  return { ...header, details }
}

export async function createStockReleaseRecord(
  tx: Prisma.TransactionClient,
  data: StockReleaseDraftWrite,
): Promise<bigint> {
  const record = await tx.stockRelease.create({
    data: {
      transactionNumber: data.transactionNumber,
      releaseDate: data.releaseDate,
      engineerName: data.engineerName,
      customerId: data.customerId,
      modelId: data.modelId,
      serviceTagId: data.serviceTagId,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
      createdById: data.createdById,
    },
    select: { id: true },
  })
  await tx.stockReleaseDetail.createMany({
    data: data.details.map((detail) => ({
      stockReleaseId: record.id,
      ...detail,
    })),
  })
  return record.id
}

export async function replaceStockReleaseDraft(
  tx: Prisma.TransactionClient,
  id: bigint,
  data: StockReleaseDraftReplacement,
): Promise<void> {
  await tx.stockReleaseDetail.deleteMany({ where: { stockReleaseId: id } })
  await tx.stockRelease.update({
    where: { id },
    data: {
      releaseDate: data.releaseDate,
      engineerName: data.engineerName,
      customerId: data.customerId,
      modelId: data.modelId,
      serviceTagId: data.serviceTagId,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
    },
  })
  await tx.stockReleaseDetail.createMany({
    data: data.details.map((detail) => ({
      stockReleaseId: id,
      ...detail,
    })),
  })
}

export async function transitionStockReleaseStatus(
  tx: Prisma.TransactionClient,
  id: bigint,
  from: TransactionStatus,
  to: TransactionStatus,
): Promise<boolean> {
  const result = await tx.stockRelease.updateMany({
    where: { id, status: from },
    data: { status: to },
  })
  return result.count === 1
}
