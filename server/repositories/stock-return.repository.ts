import {
  Prisma,
  TransactionStatus,
  type TransactionStatus as TransactionStatusValue,
} from '../../generated/prisma/client'
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
  status: TransactionStatusValue
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

type StockReturnReadClient = Pick<
  Prisma.TransactionClient,
  'stockReturn' | '$queryRaw' | 'stockRelease'
>

export async function listStockReturnRecords(
  client: StockReturnReadClient,
  { where, skip, take }: StockReturnListArguments,
): Promise<{ data: StockReturnRecord[]; total: number }> {
  const data = await client.stockReturn.findMany({
    where,
    include: stockReturnInclude,
    orderBy: [{ returnDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take,
  })
  const total = await client.stockReturn.count({ where })
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
  from: TransactionStatusValue,
  to: TransactionStatusValue,
): Promise<boolean> {
  const result = await tx.stockReturn.updateMany({
    where: { id, status: from },
    data: { status: to },
  })
  return result.count === 1
}

export interface EligibleStockReleasePageArguments {
  search?: string
  customerId?: bigint
  skip: number
  take: number
}

export async function findEligibleStockReleasePage(
  client: StockReturnReadClient,
  { search, customerId, skip, take }: EligibleStockReleasePageArguments,
): Promise<{ data: StockReleaseRecord[]; total: number }> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`sr."status" = ${TransactionStatus.COMPLETED}::"transaction_status"`,
  ]
  if (customerId !== undefined) {
    conditions.push(Prisma.sql`sr."customer_id" = ${customerId}`)
  }
  if (search) {
    const pattern = `%${search}%`
    conditions.push(Prisma.sql`(
      sr."transaction_number" ILIKE ${pattern}
      OR sr."engineer_name" ILIKE ${pattern}
      OR c."customer_name" ILIKE ${pattern}
    )`)
  }

  const eligibleWhere = Prisma.sql`
    ${Prisma.join(conditions, ' AND ')}
    AND EXISTS (
      SELECT 1
      FROM "stock_release_details" srd
      LEFT JOIN (
        SELECT
          srtd."stock_release_detail_id",
          SUM(srtd."return_quantity")::BIGINT AS "returned_quantity"
        FROM "stock_return_details" srtd
        INNER JOIN "stock_returns" srt
          ON srt."id" = srtd."stock_return_id"
        WHERE srt."status" = ${TransactionStatus.COMPLETED}::"transaction_status"
        GROUP BY srtd."stock_release_detail_id"
      ) completed_returns
        ON completed_returns."stock_release_detail_id" = srd."id"
      WHERE srd."stock_release_id" = sr."id"
        AND srd."released_quantity"::BIGINT
          > COALESCE(completed_returns."returned_quantity", 0)
    )
  `
  const countRows = await client.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::BIGINT AS "total"
    FROM "stock_releases" sr
    INNER JOIN "customers" c ON c."id" = sr."customer_id"
    WHERE ${eligibleWhere}
  `)
  const pageRows = await client.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT sr."id"
    FROM "stock_releases" sr
    INNER JOIN "customers" c ON c."id" = sr."customer_id"
    WHERE ${eligibleWhere}
    ORDER BY sr."release_date" DESC, sr."created_at" DESC, sr."id" DESC
    LIMIT ${take}
    OFFSET ${skip}
  `)
  const ids = pageRows.map(({ id }) => id)
  if (ids.length === 0) {
    return { data: [], total: Number(countRows[0]?.total ?? BigInt(0)) }
  }

  const records = await client.stockRelease.findMany({
    where: { id: { in: ids } },
    include: stockReleaseInclude,
  })
  const recordById = new Map(records.map((record) => [record.id, record]))
  return {
    data: ids.flatMap((id) => {
      const record = recordById.get(id)
      return record ? [record] : []
    }),
    total: Number(countRows[0]?.total ?? BigInt(0)),
  }
}
