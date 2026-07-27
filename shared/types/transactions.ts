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

export interface StockReleaseCustomerDto {
  id: string
  customerName: string
  isActive: boolean
}

export interface StockReleaseModelDto {
  id: string
  modelName: string
  isActive: boolean
}

export interface StockReleaseServiceTagDto {
  id: string
  serviceTag: string
  modelId: string
  customerId: string | null
  isActive: boolean
}

export interface StockReleaseDetailDto {
  id: string
  deviceDetailId: string
  sourceRackId: string
  releasedQuantity: number
  availableQuantity: number
  notes: string | null
  deviceDetail: StockAdjustmentInDeviceDetailDto
  sourceRack: StockAdjustmentInRackDto
  createdAt: string
  updatedAt: string
}

export interface StockReleaseDto {
  id: string
  transactionNumber: string
  releaseDate: string
  engineerName: string
  customerId: string
  customer: StockReleaseCustomerDto
  modelId: string | null
  model: StockReleaseModelDto | null
  serviceTagId: string | null
  serviceTag: StockReleaseServiceTagDto | null
  referenceNumber: string | null
  notes: string | null
  status: TransactionStatus
  createdById: string
  createdBy: {
    id: string
    displayName: string
  }
  details: StockReleaseDetailDto[]
  createdAt: string
  updatedAt: string
}

export type StockReleaseListResponse = PaginatedResponse<StockReleaseDto>

export interface StockReleaseReturnableDetailDto {
  stockReleaseDetailId: string
  deviceDetailId: string
  sourceRackId: string
  releasedQuantity: number
  completedReturnedQuantity: number
  remainingReturnableQuantity: number
  deviceDetail: StockAdjustmentInDeviceDetailDto
  sourceRack: StockAdjustmentInRackDto
}

export interface StockReleaseReturnableDto {
  id: string
  transactionNumber: string
  releaseDate: string
  engineerName: string
  customerId: string
  customer: StockReleaseCustomerDto
  details: StockReleaseReturnableDetailDto[]
}

export interface StockReturnDetailDto {
  id: string
  stockReleaseDetailId: string
  destinationRackId: string
  releasedQuantity: number
  previouslyReturnedQuantity: number
  remainingReturnableQuantity: number
  returnQuantity: number
  notes: string | null
  deviceDetail: StockAdjustmentInDeviceDetailDto
  sourceRack: StockAdjustmentInRackDto
  destinationRack: StockAdjustmentInRackDto
  createdAt: string
  updatedAt: string
}

export interface StockReturnDto {
  id: string
  transactionNumber: string
  returnDate: string
  stockReleaseId: string
  stockRelease: {
    id: string
    transactionNumber: string
    releaseDate: string
    engineerName: string
    customerId: string
    customer: StockReleaseCustomerDto
  }
  engineerName: string
  customerId: string
  customer: StockReleaseCustomerDto
  notes: string | null
  status: TransactionStatus
  createdById: string
  createdBy: {
    id: string
    displayName: string
  }
  details: StockReturnDetailDto[]
  createdAt: string
  updatedAt: string
}

export type StockReturnListResponse = PaginatedResponse<StockReturnDto>
export type EligibleStockReleaseListResponse = PaginatedResponse<StockReleaseReturnableDto>
