import { Prisma } from '../../generated/prisma/client'
import type {
  StockCardByCustomerReportQuery,
  StockCardReportQuery,
  StockInByCustomerReportQuery,
  StockInReportQuery,
  StockOutByCustomerReportQuery,
  StockOutReportQuery,
} from '../../shared/schemas/reports'
import { prisma } from '../utils/prisma'

export interface StockCardDatabaseRow {
  movementId: bigint
  transactionDate: Date
  transactionNumber: string
  transactionTypeCode: string
  movementPurpose: string
  deviceId: bigint
  device: string
  deviceDetailId: bigint
  partNumber: string
  dpn: string | null
  specification: string
  rackId: bigint
  rackCode: string
  rack: string
  customerId: bigint | null
  customer: string | null
  modelId: bigint | null
  model: string | null
  serviceTagId: bigint | null
  serviceTag: string | null
  engineerName: string | null
  quantityIn: number
  quantityOut: number
  runningBalance: bigint
  notes: string | null
}

export interface StockInDatabaseRow {
  movementId: bigint
  transactionDate: Date
  transactionNumber: string
  stockInTypeCode: string
  deviceId: bigint
  device: string
  deviceDetailId: bigint
  partNumber: string
  dpn: string | null
  specification: string
  quantity: number
  rackId: bigint
  rackCode: string
  rack: string
  customerId: bigint | null
  customer: string | null
  createdById: bigint
  createdBy: string
  notes: string | null
}

export interface StockOutDatabaseRow {
  movementId: bigint
  transactionDate: Date
  transactionNumber: string
  engineerName: string
  customerId: bigint
  customer: string
  modelId: bigint | null
  model: string | null
  serviceTagId: bigint | null
  serviceTag: string | null
  deviceId: bigint
  device: string
  deviceDetailId: bigint
  partNumber: string
  dpn: string | null
  specification: string
  sourceRackId: bigint
  sourceRackCode: string
  sourceRack: string
  releasedQuantity: number
  supportReference: string | null
  createdById: bigint
  createdBy: string
  notes: string | null
}

interface CountRow {
  total: bigint
}

function equalsId(column: Prisma.Sql, value: string | undefined): Prisma.Sql | null {
  return value ? Prisma.sql`${column} = ${BigInt(value)}` : null
}

function containsText(column: Prisma.Sql, value: string | undefined): Prisma.Sql | null {
  return value ? Prisma.sql`${column} ILIKE ${`%${value}%`}` : null
}

function whereSql(clauses: Array<Prisma.Sql | null>): Prisma.Sql {
  return Prisma.join(
    clauses.filter((clause): clause is Prisma.Sql => clause !== null),
    ' AND ',
  )
}

function pageOffset(filters: { page: number; pageSize: number }): number {
  return (filters.page - 1) * filters.pageSize
}

function stockCardScope(
  filters: StockCardReportQuery | StockCardByCustomerReportQuery,
): Prisma.Sql {
  const customerId = 'customerId' in filters ? filters.customerId : undefined
  const modelId = 'modelId' in filters ? filters.modelId : undefined
  const serviceTagId = 'serviceTagId' in filters ? filters.serviceTagId : undefined

  const clauses = whereSql([
    filters.dateTo ? Prisma.sql`sm.transaction_date <= ${filters.dateTo}::date` : Prisma.sql`TRUE`,
    equalsId(Prisma.sql`dd.device_id`, filters.deviceId),
    equalsId(Prisma.sql`sm.device_detail_id`, filters.deviceDetailId),
    containsText(Prisma.sql`dd.part_number`, filters.partNumber),
    containsText(Prisma.sql`dd.dpn`, filters.dpn),
    equalsId(Prisma.sql`sm.rack_id`, filters.rackId),
    filters.transactionType
      ? Prisma.sql`sm.transaction_type = ${filters.transactionType}::transaction_type`
      : null,
    equalsId(Prisma.sql`sm.customer_id`, customerId),
    equalsId(Prisma.sql`source_release.model_id`, modelId),
    equalsId(Prisma.sql`source_release.service_tag_id`, serviceTagId),
  ])

  return Prisma.sql`
    SELECT
      sm.id AS "movementId",
      sm.transaction_date AS "transactionDate",
      sm.transaction_number AS "transactionNumber",
      sm.transaction_type::text AS "transactionTypeCode",
      sm.movement_purpose::text AS "movementPurpose",
      dd.device_id AS "deviceId",
      d.device_name AS "device",
      sm.device_detail_id AS "deviceDetailId",
      dd.part_number AS "partNumber",
      dd.dpn,
      dd.specification,
      sm.rack_id AS "rackId",
      r.rack_code AS "rackCode",
      r.rack_name AS "rack",
      sm.customer_id AS "customerId",
      c.customer_name AS "customer",
      source_release.model_id AS "modelId",
      m.model_name AS "model",
      source_release.service_tag_id AS "serviceTagId",
      st.service_tag AS "serviceTag",
      sm.engineer_name AS "engineerName",
      sm.quantity_in AS "quantityIn",
      sm.quantity_out AS "quantityOut",
      sm.created_at AS "movementCreatedAt",
      CASE sm.transaction_type
        WHEN 'STOCK_ADJUSTMENT_IN' THEN COALESCE(sai_detail.notes, sai.notes)
        WHEN 'STOCK_RELEASE' THEN COALESCE(release_detail.notes, source_release.notes)
        WHEN 'STOCK_RETURN' THEN COALESCE(return_detail.notes, stock_return.notes)
      END AS "notes"
    FROM stock_movements sm
    JOIN device_details dd ON dd.id = sm.device_detail_id
    JOIN devices d ON d.id = dd.device_id
    JOIN racks r ON r.id = sm.rack_id
    LEFT JOIN customers c ON c.id = sm.customer_id
    LEFT JOIN stock_adjustment_ins sai
      ON sm.transaction_type = 'STOCK_ADJUSTMENT_IN' AND sai.id = sm.transaction_id
    LEFT JOIN stock_adjustment_in_details sai_detail
      ON sm.transaction_type = 'STOCK_ADJUSTMENT_IN'
      AND sai_detail.id = sm.transaction_detail_id
    LEFT JOIN stock_returns stock_return
      ON sm.transaction_type = 'STOCK_RETURN' AND stock_return.id = sm.transaction_id
    LEFT JOIN stock_return_details return_detail
      ON sm.transaction_type = 'STOCK_RETURN'
      AND return_detail.id = sm.transaction_detail_id
    LEFT JOIN stock_releases source_release
      ON (
        sm.transaction_type = 'STOCK_RELEASE'
        AND source_release.id = sm.transaction_id
      ) OR (
        sm.transaction_type = 'STOCK_RETURN'
        AND source_release.id = stock_return.stock_release_id
      )
    LEFT JOIN stock_release_details release_detail
      ON sm.transaction_type = 'STOCK_RELEASE'
      AND release_detail.id = sm.transaction_detail_id
    LEFT JOIN models m ON m.id = source_release.model_id
    LEFT JOIN service_tags st ON st.id = source_release.service_tag_id
    WHERE ${clauses}
  `
}

export async function queryStockCardReport(
  filters: StockCardReportQuery | StockCardByCustomerReportQuery,
): Promise<{ rows: StockCardDatabaseRow[]; total: number }> {
  const scope = stockCardScope(filters)
  const visibleDate = filters.dateFrom
    ? Prisma.sql`"transactionDate" >= ${filters.dateFrom}::date`
    : Prisma.sql`TRUE`

  const rows = await prisma.$queryRaw<StockCardDatabaseRow[]>(Prisma.sql`
      WITH ledger_scope AS (${scope}),
      calculated AS (
        SELECT
          ledger_scope.*,
          SUM("quantityIn" - "quantityOut") OVER (
            PARTITION BY "deviceDetailId", "rackId"
            ORDER BY
              "transactionDate",
              "movementCreatedAt",
              "transactionNumber",
              "movementId"
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS "runningBalance"
        FROM ledger_scope
      )
      SELECT
        "movementId",
        "transactionDate",
        "transactionNumber",
        "transactionTypeCode",
        "movementPurpose",
        "deviceId",
        "device",
        "deviceDetailId",
        "partNumber",
        "dpn",
        "specification",
        "rackId",
        "rackCode",
        "rack",
        "customerId",
        "customer",
        "modelId",
        "model",
        "serviceTagId",
        "serviceTag",
        "engineerName",
        "quantityIn",
        "quantityOut",
        "runningBalance",
        "notes"
      FROM calculated
      WHERE ${visibleDate}
      ORDER BY
        "transactionDate",
        "movementCreatedAt",
        "transactionNumber",
        "movementId"
      LIMIT ${filters.pageSize}
      OFFSET ${pageOffset(filters)}
    `)
  const counts = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    WITH ledger_scope AS (${scope})
    SELECT COUNT(*) AS "total"
    FROM ledger_scope
    WHERE ${visibleDate}
  `)

  return { rows, total: Number(counts[0]?.total ?? BigInt(0)) }
}

function stockInScope(filters: StockInReportQuery | StockInByCustomerReportQuery): Prisma.Sql {
  const customerId = 'customerId' in filters ? filters.customerId : undefined
  const clauses = whereSql([
    Prisma.sql`sm.movement_purpose = 'ORIGINAL'`,
    Prisma.sql`(
      (
        sm.transaction_type = 'STOCK_ADJUSTMENT_IN'
        AND sai.status = 'COMPLETED'
      ) OR (
        sm.transaction_type = 'STOCK_RETURN'
        AND stock_return.status = 'COMPLETED'
      )
    )`,
    filters.dateFrom
      ? Prisma.sql`sm.transaction_date >= ${filters.dateFrom}::date`
      : Prisma.sql`TRUE`,
    filters.dateTo ? Prisma.sql`sm.transaction_date <= ${filters.dateTo}::date` : Prisma.sql`TRUE`,
    equalsId(Prisma.sql`dd.device_id`, filters.deviceId),
    equalsId(Prisma.sql`sm.device_detail_id`, filters.deviceDetailId),
    containsText(Prisma.sql`dd.part_number`, filters.partNumber),
    containsText(Prisma.sql`dd.dpn`, filters.dpn),
    equalsId(Prisma.sql`sm.rack_id`, filters.rackId),
    equalsId(Prisma.sql`sm.customer_id`, customerId),
    filters.stockInType === 'ADJUSTMENT_IN'
      ? Prisma.sql`sm.transaction_type = 'STOCK_ADJUSTMENT_IN'`
      : filters.stockInType === 'RETURN'
        ? Prisma.sql`sm.transaction_type = 'STOCK_RETURN'`
        : null,
  ])

  return Prisma.sql`
    SELECT
      sm.id AS "movementId",
      sm.transaction_date AS "transactionDate",
      sm.transaction_number AS "transactionNumber",
      CASE sm.transaction_type
        WHEN 'STOCK_ADJUSTMENT_IN' THEN 'ADJUSTMENT_IN'
        WHEN 'STOCK_RETURN' THEN 'RETURN'
      END AS "stockInTypeCode",
      dd.device_id AS "deviceId",
      d.device_name AS "device",
      sm.device_detail_id AS "deviceDetailId",
      dd.part_number AS "partNumber",
      dd.dpn,
      dd.specification,
      sm.quantity_in AS "quantity",
      sm.rack_id AS "rackId",
      r.rack_code AS "rackCode",
      r.rack_name AS "rack",
      sm.customer_id AS "customerId",
      c.customer_name AS "customer",
      COALESCE(sai.created_by, stock_return.created_by) AS "createdById",
      creator.display_name AS "createdBy",
      CASE sm.transaction_type
        WHEN 'STOCK_ADJUSTMENT_IN' THEN COALESCE(sai_detail.notes, sai.notes)
        WHEN 'STOCK_RETURN' THEN COALESCE(return_detail.notes, stock_return.notes)
      END AS "notes",
      sm.created_at AS "movementCreatedAt"
    FROM stock_movements sm
    JOIN device_details dd ON dd.id = sm.device_detail_id
    JOIN devices d ON d.id = dd.device_id
    JOIN racks r ON r.id = sm.rack_id
    LEFT JOIN customers c ON c.id = sm.customer_id
    LEFT JOIN stock_adjustment_ins sai
      ON sm.transaction_type = 'STOCK_ADJUSTMENT_IN' AND sai.id = sm.transaction_id
    LEFT JOIN stock_adjustment_in_details sai_detail
      ON sm.transaction_type = 'STOCK_ADJUSTMENT_IN'
      AND sai_detail.id = sm.transaction_detail_id
    LEFT JOIN stock_returns stock_return
      ON sm.transaction_type = 'STOCK_RETURN' AND stock_return.id = sm.transaction_id
    LEFT JOIN stock_return_details return_detail
      ON sm.transaction_type = 'STOCK_RETURN'
      AND return_detail.id = sm.transaction_detail_id
    LEFT JOIN users creator
      ON creator.id = COALESCE(sai.created_by, stock_return.created_by)
    WHERE ${clauses}
  `
}

export async function queryStockInReport(
  filters: StockInReportQuery | StockInByCustomerReportQuery,
): Promise<{ rows: StockInDatabaseRow[]; total: number }> {
  const scope = stockInScope(filters)
  const rows = await prisma.$queryRaw<StockInDatabaseRow[]>(Prisma.sql`
      WITH report_rows AS (${scope})
      SELECT
        "movementId",
        "transactionDate",
        "transactionNumber",
        "stockInTypeCode",
        "deviceId",
        "device",
        "deviceDetailId",
        "partNumber",
        "dpn",
        "specification",
        "quantity",
        "rackId",
        "rackCode",
        "rack",
        "customerId",
        "customer",
        "createdById",
        "createdBy",
        "notes"
      FROM report_rows
      ORDER BY
        "transactionDate",
        "movementCreatedAt",
        "transactionNumber",
        "movementId"
      LIMIT ${filters.pageSize}
      OFFSET ${pageOffset(filters)}
    `)
  const counts = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    WITH report_rows AS (${scope})
    SELECT COUNT(*) AS "total" FROM report_rows
  `)
  return { rows, total: Number(counts[0]?.total ?? BigInt(0)) }
}

function stockOutScope(filters: StockOutReportQuery | StockOutByCustomerReportQuery): Prisma.Sql {
  const clauses = whereSql([
    Prisma.sql`sm.movement_purpose = 'ORIGINAL'`,
    Prisma.sql`sm.transaction_type = 'STOCK_RELEASE'`,
    Prisma.sql`stock_release.status = 'COMPLETED'`,
    filters.dateFrom
      ? Prisma.sql`sm.transaction_date >= ${filters.dateFrom}::date`
      : Prisma.sql`TRUE`,
    filters.dateTo ? Prisma.sql`sm.transaction_date <= ${filters.dateTo}::date` : Prisma.sql`TRUE`,
    containsText(Prisma.sql`stock_release.engineer_name`, filters.engineerName),
    equalsId(Prisma.sql`stock_release.customer_id`, filters.customerId),
    equalsId(Prisma.sql`stock_release.model_id`, filters.modelId),
    equalsId(Prisma.sql`stock_release.service_tag_id`, filters.serviceTagId),
    equalsId(Prisma.sql`dd.device_id`, filters.deviceId),
    equalsId(Prisma.sql`sm.device_detail_id`, filters.deviceDetailId),
    containsText(Prisma.sql`dd.part_number`, filters.partNumber),
    containsText(Prisma.sql`dd.dpn`, filters.dpn),
    equalsId(Prisma.sql`sm.rack_id`, filters.rackId),
  ])

  return Prisma.sql`
    SELECT
      sm.id AS "movementId",
      sm.transaction_date AS "transactionDate",
      sm.transaction_number AS "transactionNumber",
      stock_release.engineer_name AS "engineerName",
      stock_release.customer_id AS "customerId",
      c.customer_name AS "customer",
      stock_release.model_id AS "modelId",
      m.model_name AS "model",
      stock_release.service_tag_id AS "serviceTagId",
      st.service_tag AS "serviceTag",
      dd.device_id AS "deviceId",
      d.device_name AS "device",
      sm.device_detail_id AS "deviceDetailId",
      dd.part_number AS "partNumber",
      dd.dpn,
      dd.specification,
      sm.rack_id AS "sourceRackId",
      r.rack_code AS "sourceRackCode",
      r.rack_name AS "sourceRack",
      sm.quantity_out AS "releasedQuantity",
      stock_release.reference_number AS "supportReference",
      stock_release.created_by AS "createdById",
      creator.display_name AS "createdBy",
      COALESCE(release_detail.notes, stock_release.notes) AS "notes",
      sm.created_at AS "movementCreatedAt"
    FROM stock_movements sm
    JOIN stock_releases stock_release ON stock_release.id = sm.transaction_id
    JOIN stock_release_details release_detail
      ON release_detail.id = sm.transaction_detail_id
    JOIN device_details dd ON dd.id = sm.device_detail_id
    JOIN devices d ON d.id = dd.device_id
    JOIN racks r ON r.id = sm.rack_id
    JOIN customers c ON c.id = stock_release.customer_id
    JOIN users creator ON creator.id = stock_release.created_by
    LEFT JOIN models m ON m.id = stock_release.model_id
    LEFT JOIN service_tags st ON st.id = stock_release.service_tag_id
    WHERE ${clauses}
  `
}

export async function queryStockOutReport(
  filters: StockOutReportQuery | StockOutByCustomerReportQuery,
): Promise<{ rows: StockOutDatabaseRow[]; total: number }> {
  const scope = stockOutScope(filters)
  const rows = await prisma.$queryRaw<StockOutDatabaseRow[]>(Prisma.sql`
      WITH report_rows AS (${scope})
      SELECT
        "movementId",
        "transactionDate",
        "transactionNumber",
        "engineerName",
        "customerId",
        "customer",
        "modelId",
        "model",
        "serviceTagId",
        "serviceTag",
        "deviceId",
        "device",
        "deviceDetailId",
        "partNumber",
        "dpn",
        "specification",
        "sourceRackId",
        "sourceRackCode",
        "sourceRack",
        "releasedQuantity",
        "supportReference",
        "createdById",
        "createdBy",
        "notes"
      FROM report_rows
      ORDER BY
        "transactionDate",
        "movementCreatedAt",
        "transactionNumber",
        "movementId"
      LIMIT ${filters.pageSize}
      OFFSET ${pageOffset(filters)}
    `)
  const counts = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    WITH report_rows AS (${scope})
    SELECT COUNT(*) AS "total" FROM report_rows
  `)
  return { rows, total: Number(counts[0]?.total ?? BigInt(0)) }
}
