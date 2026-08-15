import ExcelJS from 'exceljs'
import { MAX_PAGE_SIZE } from '../../shared/constants/app'
import type {
  ReportResult,
  StockCardReportRow,
  StockInReportRow,
  StockOutReportRow,
} from '../../shared/types/reports'
import { withReportReadSnapshot, type ReportReadClient } from '../repositories/report.repository'
import {
  getStockCardByCustomerReport,
  getStockCardReport,
  getStockInByCustomerReport,
  getStockInReport,
  getStockOutByCustomerReport,
  getStockOutReport,
} from './report.service'

type ReportFilters = Record<string, unknown> & { page: number; pageSize: number }
type CellValue = Date | number | string | null

export interface ReportColumn<TRow> {
  key: string
  label: string
  width: number
  value: (row: TRow) => unknown
  kind?: 'date' | 'integer' | 'text'
}

export interface ReportWorkbookDefinition<TRow> {
  title: string
  sheetName: string
  filenameStem: string
  columns: ReportColumn<TRow>[]
}

const formulaPrefix = /^[=+\-@]/

function safeText(value: string): string {
  return formulaPrefix.test(value) ? `'${value}` : value
}

function safeWorksheetName(value: string): string {
  const sanitized = value
    .replace(/[\\/*?:[\]]/g, '-')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31)
  return sanitized || 'Report'
}

function dateCell(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Excel date values must use YYYY-MM-DD format.')
  }
  const result = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    throw new TypeError('Excel date values must be valid dates.')
  }
  return result
}

function integerCell(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError('Excel integer exceeds the supported safe range.')
    }
    return Number(value)
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError('Excel integer values must be safe integers.')
  }
  return value
}

function excelCell(value: unknown, kind: ReportColumn<unknown>['kind']): CellValue {
  if (kind === 'date') return dateCell(value)
  if (kind === 'integer') return integerCell(value)
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return safeText(value.toString())
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Excel numeric values must be finite.')
    return value
  }
  return safeText(String(value))
}

function displayedFilters(filters: ReportFilters): [string, string][] {
  return Object.entries(filters)
    .filter(([key, value]) => key !== 'page' && key !== 'pageSize' && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, safeText(String(value))])
}

export async function buildReportWorkbook<TRow, TFilters extends ReportFilters>(
  definition: ReportWorkbookDefinition<TRow>,
  result: ReportResult<TRow, TFilters>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mini Inventory'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet(safeWorksheetName(definition.sheetName), {
    views: [{ state: 'frozen', ySplit: 5 }],
  })

  worksheet.mergeCells(1, 1, 1, definition.columns.length)
  const title = worksheet.getCell(1, 1)
  title.value = safeText(definition.title)
  title.font = { bold: true, size: 16 }

  worksheet.getCell(2, 1).value = 'Generated At'
  worksheet.getCell(2, 2).value = new Date()
  worksheet.getCell(2, 2).numFmt = 'yyyy-mm-dd hh:mm:ss'
  worksheet.getCell(3, 1).value = 'Applied Filters'
  worksheet.getCell(3, 2).value = displayedFilters(result.filters)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')

  const headingRowNumber = 5
  const headingRow = worksheet.getRow(headingRowNumber)
  headingRow.values = definition.columns.map((column) => column.label)
  headingRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headingRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  headingRow.alignment = { vertical: 'middle' }
  worksheet.autoFilter = {
    from: { row: headingRowNumber, column: 1 },
    to: { row: headingRowNumber, column: definition.columns.length },
  }

  definition.columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width
  })

  for (const reportRow of result.rows) {
    const row = worksheet.addRow(
      definition.columns.map((column) => excelCell(column.value(reportRow), column.kind)),
    )
    definition.columns.forEach((column, index) => {
      if (column.kind === 'date') row.getCell(index + 1).numFmt = 'yyyy-mm-dd'
      if (column.kind === 'integer') row.getCell(index + 1).numFmt = '0'
    })
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

type ReportGetter<TRow, TFilters extends ReportFilters> = (
  query: unknown,
  client?: ReportReadClient,
) => Promise<ReportResult<TRow, TFilters>>

async function collectAllRows<TRow, TFilters extends ReportFilters>(
  getter: ReportGetter<TRow, TFilters>,
  query: unknown,
): Promise<ReportResult<TRow, TFilters>> {
  return withReportReadSnapshot(async (client) => {
    const rawQuery = query && typeof query === 'object' ? query : {}
    const first = await getter({ ...rawQuery, page: 1, pageSize: MAX_PAGE_SIZE }, client)
    const rows = [...first.rows]
    const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE)
    for (let page = 2; page <= pageCount; page += 1) {
      const next = await getter({ ...first.filters, page, pageSize: MAX_PAGE_SIZE }, client)
      rows.push(...next.rows)
    }
    if (rows.length !== first.total) {
      throw new Error('Report changed while the Excel export was being generated. Please retry.')
    }
    return { ...first, rows }
  })
}

const stockCardColumns: ReportColumn<StockCardReportRow>[] = [
  {
    key: 'transactionDate',
    label: 'Transaction Date',
    width: 16,
    kind: 'date',
    value: (r) => r.transactionDate,
  },
  {
    key: 'transactionNumber',
    label: 'Transaction Number',
    width: 22,
    value: (r) => r.transactionNumber,
  },
  { key: 'transactionType', label: 'Transaction Type', width: 22, value: (r) => r.transactionType },
  { key: 'device', label: 'Device', width: 20, value: (r) => r.device },
  { key: 'partNumber', label: 'Part Number', width: 20, value: (r) => r.partNumber },
  { key: 'dpn', label: 'DP/N', width: 20, value: (r) => r.dpn },
  { key: 'specification', label: 'Specification', width: 36, value: (r) => r.specification },
  { key: 'rack', label: 'Rack', width: 20, value: (r) => r.rack },
  { key: 'customer', label: 'Customer', width: 24, value: (r) => r.customer },
  { key: 'engineerName', label: 'Engineer Name', width: 24, value: (r) => r.engineerName },
  {
    key: 'quantityIn',
    label: 'Quantity In',
    width: 14,
    kind: 'integer',
    value: (r) => r.quantityIn,
  },
  {
    key: 'quantityOut',
    label: 'Quantity Out',
    width: 14,
    kind: 'integer',
    value: (r) => r.quantityOut,
  },
  {
    key: 'runningBalance',
    label: 'Running Balance',
    width: 17,
    kind: 'integer',
    value: (r) => r.runningBalance,
  },
  { key: 'notes', label: 'Notes', width: 32, value: (r) => r.notes },
]

const customerStockCardColumns: ReportColumn<StockCardReportRow>[] = [
  { key: 'customer', label: 'Customer', width: 24, value: (r) => r.customer },
  ...stockCardColumns.slice(0, 3),
  { key: 'model', label: 'Model', width: 22, value: (r) => r.model },
  { key: 'serviceTag', label: 'Service Tag', width: 20, value: (r) => r.serviceTag },
  ...stockCardColumns.slice(3, 8),
  ...stockCardColumns.slice(9, 12),
  stockCardColumns[13]!,
]

const stockInColumns: ReportColumn<StockInReportRow>[] = [
  {
    key: 'transactionDate',
    label: 'Transaction Date',
    width: 16,
    kind: 'date',
    value: (r) => r.transactionDate,
  },
  {
    key: 'transactionNumber',
    label: 'Transaction Number',
    width: 22,
    value: (r) => r.transactionNumber,
  },
  { key: 'stockInType', label: 'Stock-In Type', width: 18, value: (r) => r.stockInType },
  { key: 'device', label: 'Device', width: 20, value: (r) => r.device },
  { key: 'partNumber', label: 'Part Number', width: 20, value: (r) => r.partNumber },
  { key: 'dpn', label: 'DP/N', width: 20, value: (r) => r.dpn },
  { key: 'specification', label: 'Specification', width: 36, value: (r) => r.specification },
  { key: 'quantity', label: 'Quantity', width: 14, kind: 'integer', value: (r) => r.quantity },
  { key: 'rack', label: 'Rack', width: 20, value: (r) => r.rack },
  { key: 'customer', label: 'Customer', width: 24, value: (r) => r.customer },
  { key: 'createdBy', label: 'Created By', width: 24, value: (r) => r.createdBy },
  { key: 'notes', label: 'Notes', width: 32, value: (r) => r.notes },
]

const stockOutColumns: ReportColumn<StockOutReportRow>[] = [
  {
    key: 'transactionDate',
    label: 'Release Date',
    width: 16,
    kind: 'date',
    value: (r) => r.transactionDate,
  },
  {
    key: 'transactionNumber',
    label: 'Stock Release Number',
    width: 24,
    value: (r) => r.transactionNumber,
  },
  { key: 'engineerName', label: 'Engineer Name', width: 24, value: (r) => r.engineerName },
  { key: 'customer', label: 'Customer', width: 24, value: (r) => r.customer },
  { key: 'model', label: 'Model', width: 22, value: (r) => r.model },
  { key: 'serviceTag', label: 'Service Tag', width: 20, value: (r) => r.serviceTag },
  { key: 'device', label: 'Device', width: 20, value: (r) => r.device },
  { key: 'partNumber', label: 'Part Number', width: 20, value: (r) => r.partNumber },
  { key: 'dpn', label: 'DP/N', width: 20, value: (r) => r.dpn },
  { key: 'specification', label: 'Specification', width: 36, value: (r) => r.specification },
  { key: 'sourceRack', label: 'Source Rack', width: 20, value: (r) => r.sourceRack },
  {
    key: 'releasedQuantity',
    label: 'Released Quantity',
    width: 18,
    kind: 'integer',
    value: (r) => r.releasedQuantity,
  },
  {
    key: 'supportReference',
    label: 'Support Ticket / Reference',
    width: 28,
    value: (r) => r.supportReference,
  },
  { key: 'createdBy', label: 'Created By', width: 24, value: (r) => r.createdBy },
  { key: 'notes', label: 'Notes', width: 32, value: (r) => r.notes },
]

export const reportWorkbookDefinitions = {
  stockCard: {
    title: 'Stock Card Report',
    sheetName: 'Stock Card',
    filenameStem: 'stock-card',
    columns: stockCardColumns,
  },
  stockCardByCustomer: {
    title: 'Stock Card Report by Customer',
    sheetName: 'Stock Card Customer',
    filenameStem: 'stock-card-by-customer',
    columns: customerStockCardColumns,
  },
  stockIn: {
    title: 'Stock-In Report',
    sheetName: 'Stock In',
    filenameStem: 'stock-in',
    columns: stockInColumns,
  },
  stockInByCustomer: {
    title: 'Stock-In Report by Customer',
    sheetName: 'Stock In Customer',
    filenameStem: 'stock-in-by-customer',
    columns: stockInColumns,
  },
  stockOut: {
    title: 'Stock-Out Report',
    sheetName: 'Stock Out',
    filenameStem: 'stock-out',
    columns: stockOutColumns,
  },
  stockOutByCustomer: {
    title: 'Stock-Out Report by Customer',
    sheetName: 'Stock Out Customer',
    filenameStem: 'stock-out-by-customer',
    columns: stockOutColumns,
  },
} satisfies Record<
  string,
  | ReportWorkbookDefinition<never>
  | ReportWorkbookDefinition<StockCardReportRow>
  | ReportWorkbookDefinition<StockInReportRow>
  | ReportWorkbookDefinition<StockOutReportRow>
>

export async function buildStockCardWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockCard,
    await collectAllRows(getStockCardReport, query),
  )
}

export async function buildStockCardByCustomerWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockCardByCustomer,
    await collectAllRows(getStockCardByCustomerReport, query),
  )
}

export async function buildStockInWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockIn,
    await collectAllRows(getStockInReport, query),
  )
}

export async function buildStockInByCustomerWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockInByCustomer,
    await collectAllRows(getStockInByCustomerReport, query),
  )
}

export async function buildStockOutWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockOut,
    await collectAllRows(getStockOutReport, query),
  )
}

export async function buildStockOutByCustomerWorkbook(query: unknown = {}): Promise<Buffer> {
  return buildReportWorkbook(
    reportWorkbookDefinitions.stockOutByCustomer,
    await collectAllRows(getStockOutByCustomerReport, query),
  )
}

export function reportExportFilename(stem: string, now = new Date()): string {
  const safeStem =
    stem
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `${safeStem}-${timestamp}.xlsx`
}
