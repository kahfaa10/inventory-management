import type { MovementPurpose, TransactionType } from '../enums/inventory'

export type StockInType = 'ADJUSTMENT_IN' | 'RETURN'

export interface ReportResult<TRow, TFilters> {
  rows: TRow[]
  page: number
  pageSize: number
  total: number
  filters: TFilters
}

export interface StockCardReportRow {
  movementId: string
  transactionDate: string
  transactionNumber: string
  transactionType: 'Stock Adjustment In' | 'Stock Release' | 'Stock Return'
  transactionTypeCode: TransactionType
  movementPurpose: MovementPurpose
  deviceId: string
  device: string
  deviceDetailId: string
  partNumber: string
  dpn: string | null
  specification: string
  rackId: string
  rackCode: string
  rack: string
  customerId: string | null
  customer: string | null
  modelId: string | null
  model: string | null
  serviceTagId: string | null
  serviceTag: string | null
  engineerName: string | null
  quantityIn: number
  quantityOut: number
  runningBalance: number
  notes: string | null
}

export interface StockInReportRow {
  movementId: string
  transactionDate: string
  transactionNumber: string
  stockInType: 'Adjustment In' | 'Return'
  stockInTypeCode: StockInType
  deviceId: string
  device: string
  deviceDetailId: string
  partNumber: string
  dpn: string | null
  specification: string
  quantity: number
  rackId: string
  rackCode: string
  rack: string
  customerId: string | null
  customer: string | null
  createdById: string
  createdBy: string
  notes: string | null
}

export interface StockOutReportRow {
  movementId: string
  transactionDate: string
  transactionNumber: string
  engineerName: string
  customerId: string
  customer: string
  modelId: string | null
  model: string | null
  serviceTagId: string | null
  serviceTag: string | null
  deviceId: string
  device: string
  deviceDetailId: string
  partNumber: string
  dpn: string | null
  specification: string
  sourceRackId: string
  sourceRackCode: string
  sourceRack: string
  releasedQuantity: number
  supportReference: string | null
  createdById: string
  createdBy: string
  notes: string | null
}
