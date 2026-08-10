import type { ZodType } from 'zod'
import type { TransactionType } from '../../shared/enums/inventory'
import {
  stockCardByCustomerReportQuerySchema,
  stockCardReportQuerySchema,
  stockInByCustomerReportQuerySchema,
  stockInReportQuerySchema,
  stockOutByCustomerReportQuerySchema,
  stockOutReportQuerySchema,
  type StockCardByCustomerReportQuery,
  type StockCardReportQuery,
  type StockInByCustomerReportQuery,
  type StockInReportQuery,
  type StockOutByCustomerReportQuery,
  type StockOutReportQuery,
} from '../../shared/schemas/reports'
import type {
  ReportResult,
  StockCardReportRow,
  StockInReportRow,
  StockOutReportRow,
} from '../../shared/types/reports'
import {
  queryStockCardReport,
  queryStockInReport,
  queryStockOutReport,
  type ReportReadClient,
  type StockCardDatabaseRow,
  type StockInDatabaseRow,
  type StockOutDatabaseRow,
} from '../repositories/report.repository'
import { parseQuery } from '../utils/validation'

const transactionTypeLabels = {
  STOCK_ADJUSTMENT_IN: 'Stock Adjustment In',
  STOCK_RELEASE: 'Stock Release',
  STOCK_RETURN: 'Stock Return',
} as const

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function safeQuantity(value: bigint): number {
  const quantity = Number(value)
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError('Report quantity exceeds the supported integer range.')
  }
  return quantity
}

function parseReportQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parseQuery(schema, query ?? {})
}

function stockCardRow(row: StockCardDatabaseRow): StockCardReportRow {
  const transactionTypeCode = row.transactionTypeCode as TransactionType
  return {
    movementId: row.movementId.toString(),
    transactionDate: dateOnly(row.transactionDate),
    transactionNumber: row.transactionNumber,
    transactionType: transactionTypeLabels[transactionTypeCode],
    transactionTypeCode,
    movementPurpose: row.movementPurpose as StockCardReportRow['movementPurpose'],
    deviceId: row.deviceId.toString(),
    device: row.device,
    deviceDetailId: row.deviceDetailId.toString(),
    partNumber: row.partNumber,
    dpn: row.dpn,
    specification: row.specification,
    rackId: row.rackId.toString(),
    rackCode: row.rackCode,
    rack: row.rack,
    customerId: row.customerId?.toString() ?? null,
    customer: row.customer,
    modelId: row.modelId?.toString() ?? null,
    model: row.model,
    serviceTagId: row.serviceTagId?.toString() ?? null,
    serviceTag: row.serviceTag,
    engineerName: row.engineerName,
    quantityIn: row.quantityIn,
    quantityOut: row.quantityOut,
    runningBalance: safeQuantity(row.runningBalance),
    notes: row.notes,
  }
}

function stockInRow(row: StockInDatabaseRow): StockInReportRow {
  const stockInTypeCode = row.stockInTypeCode as StockInReportRow['stockInTypeCode']
  return {
    movementId: row.movementId.toString(),
    transactionDate: dateOnly(row.transactionDate),
    transactionNumber: row.transactionNumber,
    stockInType: stockInTypeCode === 'ADJUSTMENT_IN' ? 'Adjustment In' : 'Return',
    stockInTypeCode,
    deviceId: row.deviceId.toString(),
    device: row.device,
    deviceDetailId: row.deviceDetailId.toString(),
    partNumber: row.partNumber,
    dpn: row.dpn,
    specification: row.specification,
    quantity: row.quantity,
    rackId: row.rackId.toString(),
    rackCode: row.rackCode,
    rack: row.rack,
    customerId: row.customerId?.toString() ?? null,
    customer: row.customer,
    createdById: row.createdById.toString(),
    createdBy: row.createdBy,
    notes: row.notes,
  }
}

function stockOutRow(row: StockOutDatabaseRow): StockOutReportRow {
  return {
    movementId: row.movementId.toString(),
    transactionDate: dateOnly(row.transactionDate),
    transactionNumber: row.transactionNumber,
    engineerName: row.engineerName,
    customerId: row.customerId.toString(),
    customer: row.customer,
    modelId: row.modelId?.toString() ?? null,
    model: row.model,
    serviceTagId: row.serviceTagId?.toString() ?? null,
    serviceTag: row.serviceTag,
    deviceId: row.deviceId.toString(),
    device: row.device,
    deviceDetailId: row.deviceDetailId.toString(),
    partNumber: row.partNumber,
    dpn: row.dpn,
    specification: row.specification,
    sourceRackId: row.sourceRackId.toString(),
    sourceRackCode: row.sourceRackCode,
    sourceRack: row.sourceRack,
    releasedQuantity: row.releasedQuantity,
    supportReference: row.supportReference,
    createdById: row.createdById.toString(),
    createdBy: row.createdBy,
    notes: row.notes,
  }
}

async function stockCardResult<TFilters extends StockCardReportQuery>(
  filters: TFilters,
  client?: ReportReadClient,
): Promise<ReportResult<StockCardReportRow, TFilters>> {
  const result = await queryStockCardReport(filters, client)
  return {
    rows: result.rows.map(stockCardRow),
    page: filters.page,
    pageSize: filters.pageSize,
    total: result.total,
    filters,
  }
}

async function stockInResult<TFilters extends StockInReportQuery>(
  filters: TFilters,
  client?: ReportReadClient,
): Promise<ReportResult<StockInReportRow, TFilters>> {
  const result = await queryStockInReport(filters, client)
  return {
    rows: result.rows.map(stockInRow),
    page: filters.page,
    pageSize: filters.pageSize,
    total: result.total,
    filters,
  }
}

async function stockOutResult<TFilters extends StockOutReportQuery>(
  filters: TFilters,
  client?: ReportReadClient,
): Promise<ReportResult<StockOutReportRow, TFilters>> {
  const result = await queryStockOutReport(filters, client)
  return {
    rows: result.rows.map(stockOutRow),
    page: filters.page,
    pageSize: filters.pageSize,
    total: result.total,
    filters,
  }
}

export async function getStockCardReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockCardReportRow, StockCardReportQuery>> {
  return await stockCardResult(parseReportQuery(stockCardReportQuerySchema, query), client)
}

export async function getStockCardByCustomerReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockCardReportRow, StockCardByCustomerReportQuery>> {
  return await stockCardResult(
    parseReportQuery(stockCardByCustomerReportQuerySchema, query),
    client,
  )
}

export async function getStockInReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockInReportRow, StockInReportQuery>> {
  return await stockInResult(parseReportQuery(stockInReportQuerySchema, query), client)
}

export async function getStockInByCustomerReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockInReportRow, StockInByCustomerReportQuery>> {
  return await stockInResult(parseReportQuery(stockInByCustomerReportQuerySchema, query), client)
}

export async function getStockOutReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockOutReportRow, StockOutReportQuery>> {
  return await stockOutResult(parseReportQuery(stockOutReportQuerySchema, query), client)
}

export async function getStockOutByCustomerReport(
  query: unknown = {},
  client?: ReportReadClient,
): Promise<ReportResult<StockOutReportRow, StockOutByCustomerReportQuery>> {
  return await stockOutResult(parseReportQuery(stockOutByCustomerReportQuerySchema, query), client)
}
