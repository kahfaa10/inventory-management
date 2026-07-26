import type { TransactionStatus } from '../enums/inventory'
import type { PaginatedResponse } from './api'

export interface StockAdjustmentInCustomerDto {
  id: string
  customerName: string
  isActive: boolean
}

export interface StockAdjustmentInDeviceDetailDto {
  id: string
  deviceId: string
  partNumber: string
  dpn: string | null
  specification: string
  isActive: boolean
  device: {
    id: string
    deviceName: string
    isActive: boolean
  }
}

export interface StockAdjustmentInRackDto {
  id: string
  rackCode: string
  rackName: string
  isActive: boolean
}

export interface StockAdjustmentInDetailDto {
  id: string
  deviceDetailId: string
  destinationRackId: string
  quantity: number
  notes: string | null
  deviceDetail: StockAdjustmentInDeviceDetailDto
  destinationRack: StockAdjustmentInRackDto
  createdAt: string
  updatedAt: string
}

export interface StockAdjustmentInDto {
  id: string
  transactionNumber: string
  transactionDate: string
  customerId: string | null
  customer: StockAdjustmentInCustomerDto | null
  notes: string | null
  status: TransactionStatus
  createdById: string
  createdBy: {
    id: string
    displayName: string
  }
  details: StockAdjustmentInDetailDto[]
  createdAt: string
  updatedAt: string
}

export type StockAdjustmentInListResponse = PaginatedResponse<StockAdjustmentInDto>
