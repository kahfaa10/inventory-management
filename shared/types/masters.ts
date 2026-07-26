export interface MasterAuditDto {
  id: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ModelDto extends MasterAuditDto {
  modelName: string
  description: string | null
}

export interface CustomerSummaryDto {
  id: string
  customerName: string
  isActive: boolean
}

export interface ModelSummaryDto {
  id: string
  modelName: string
  isActive: boolean
}

export interface ServiceTagDto extends MasterAuditDto {
  modelId: string
  customerId: string | null
  serviceTag: string
  description: string | null
  model: ModelSummaryDto
  customer: CustomerSummaryDto | null
}

export interface DeviceDto extends MasterAuditDto {
  deviceName: string
  description: string | null
}

export interface DeviceSummaryDto {
  id: string
  deviceName: string
  isActive: boolean
}

export interface DeviceDetailDto extends MasterAuditDto {
  deviceId: string
  partNumber: string
  dpn: string | null
  specification: string
  description: string | null
  device: DeviceSummaryDto
}

export interface CustomerDto extends MasterAuditDto {
  customerName: string
  address: string | null
  contactPerson: string | null
  contactNumber: string | null
  description: string | null
}

export interface RackDto extends MasterAuditDto {
  rackCode: string
  rackName: string
  description: string | null
}
