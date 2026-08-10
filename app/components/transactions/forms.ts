import type {
  CustomerDto,
  DeviceDetailDto,
  DeviceDto,
  ModelDto,
  RackDto,
  ServiceTagDto,
} from '#shared/types/masters'
import type { StockReleaseReturnableDto } from '#shared/types/transactions'

export type CustomerOption = Pick<CustomerDto, 'id' | 'customerName' | 'isActive'>
export type DeviceOption = Pick<DeviceDto, 'id' | 'deviceName' | 'isActive'>
export type DeviceDetailOption = Pick<
  DeviceDetailDto,
  'id' | 'deviceId' | 'partNumber' | 'dpn' | 'specification' | 'isActive' | 'device'
>
export type RackOption = Pick<RackDto, 'id' | 'rackCode' | 'rackName' | 'isActive'>
export type ModelOption = Pick<ModelDto, 'id' | 'modelName' | 'isActive'>
export type ServiceTagOption = Pick<
  ServiceTagDto,
  'id' | 'serviceTag' | 'modelId' | 'customerId' | 'isActive'
>

export interface AdjustmentDetailFormRow {
  key: string
  deviceId: string
  deviceDetailId: string
  destinationRackId: string
  quantity: number
  notes: string
}

export interface AdjustmentInFormState {
  transactionDate: string
  customerId: string | null
  notes: string
  details: AdjustmentDetailFormRow[]
}

export interface ReleaseDetailFormRow {
  key: string
  deviceId: string
  deviceDetailId: string
  sourceRackId: string
  releasedQuantity: number
  notes: string
}

export interface StockReleaseFormState {
  releaseDate: string
  engineerName: string
  customerId: string
  modelId: string | null
  serviceTagId: string | null
  referenceNumber: string
  notes: string
  details: ReleaseDetailFormRow[]
}

export interface ReturnDetailFormRow {
  key: string
  stockReleaseDetailId: string
  destinationRackId: string
  returnQuantity: number
  notes: string
}

export interface StockReturnFormState {
  returnDate: string
  stockReleaseId: string
  notes: string
  details: ReturnDetailFormRow[]
}

export type EligibleReleaseOption = StockReleaseReturnableDto

export function localKey() {
  return `detail-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function cloneForm<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
