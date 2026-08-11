<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { stockOutByCustomerReportQuerySchema } from '#shared/schemas/reports'
import type {
  CustomerDto,
  DeviceDetailDto,
  DeviceDto,
  ModelDto,
  RackDto,
  ServiceTagDto,
} from '#shared/types/masters'
import type { StockOutReportRow } from '#shared/types/reports'
import type { ReportFilterDefinition } from '../../components/reports/ReportFilters.vue'

const report = useInventoryReport<StockOutReportRow, Record<string, unknown>>({
  endpoint: '/api/reports/stock-out-by-customer',
  exportEndpoint: '/api/reports/stock-out-by-customer/export',
  schema: stockOutByCustomerReportQuerySchema,
  customerRequired: true,
  initialFilters: {
    dateFrom: '',
    dateTo: '',
    customerId: '',
    modelId: '',
    serviceTagId: '',
    engineerName: '',
    deviceId: '',
    deviceDetailId: '',
    partNumber: '',
    dpn: '',
    rackId: '',
  },
})
const customers = useReportMasterOptions<CustomerDto>('/api/customers')
const models = useReportMasterOptions<ModelDto>('/api/models')
const serviceTags = useReportMasterOptions<ServiceTagDto>('/api/service-tags')
const devices = useReportMasterOptions<DeviceDto>('/api/devices')
const deviceDetails = useReportMasterOptions<DeviceDetailDto>('/api/device-details')
const racks = useReportMasterOptions<RackDto>('/api/racks')
const optionsLoading = computed(() =>
  [customers, models, serviceTags, devices, deviceDetails, racks].some(
    (resource) => resource.pending.value,
  ),
)
const filters = computed<ReportFilterDefinition[]>(() => [
  { name: 'dateFrom', label: 'Date From', kind: 'date' },
  { name: 'dateTo', label: 'Date To', kind: 'date' },
  {
    name: 'customerId',
    label: 'Customer',
    kind: 'select',
    required: true,
    options: [
      { label: 'Select Customer', value: '' },
      ...(customers.data.value ?? []).map((item) => ({ label: item.customerName, value: item.id })),
    ],
  },
  {
    name: 'modelId',
    label: 'Model',
    kind: 'select',
    options: [
      { label: 'All Models', value: '' },
      ...(models.data.value ?? []).map((item) => ({ label: item.modelName, value: item.id })),
    ],
  },
  {
    name: 'serviceTagId',
    label: 'Service Tag',
    kind: 'select',
    options: [
      { label: 'All Service Tags', value: '' },
      ...(serviceTags.data.value ?? [])
        .filter((item) => !report.filters.modelId || item.modelId === report.filters.modelId)
        .filter((item) => item.customerId === report.filters.customerId)
        .map((item) => ({ label: item.serviceTag, value: item.id })),
    ],
  },
  { name: 'engineerName', label: 'Engineer Name', kind: 'text', placeholder: 'Engineer name' },
  {
    name: 'deviceId',
    label: 'Part',
    kind: 'select',
    options: [
      { label: 'All Parts', value: '' },
      ...(devices.data.value ?? []).map((item) => ({ label: item.deviceName, value: item.id })),
    ],
  },
  {
    name: 'deviceDetailId',
    label: 'Part Detail',
    kind: 'select',
    options: [
      { label: 'All Part Details', value: '' },
      ...(deviceDetails.data.value ?? [])
        .filter((item) => !report.filters.deviceId || item.deviceId === report.filters.deviceId)
        .map((item) => ({ label: `${item.partNumber} — ${item.specification}`, value: item.id })),
    ],
  },
  { name: 'partNumber', label: 'Part Number', kind: 'text', placeholder: 'Filter by part number' },
  { name: 'dpn', label: 'DP/N', kind: 'text', placeholder: 'Filter by DP/N' },
  {
    name: 'rackId',
    label: 'Rack',
    kind: 'select',
    options: [
      { label: 'All Racks', value: '' },
      ...(racks.data.value ?? []).map((item) => ({
        label: `${item.rackCode} — ${item.rackName}`,
        value: item.id,
      })),
    ],
  },
])
const columns: TableColumn<StockOutReportRow>[] = [
  { accessorKey: 'transactionDate', header: 'Release Date' },
  { accessorKey: 'transactionNumber', header: 'Stock Release Number' },
  { accessorKey: 'engineerName', header: 'Engineer Name' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'serviceTag', header: 'Service Tag' },
  { accessorKey: 'device', header: 'Part' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'dpn', header: 'DP/N' },
  { accessorKey: 'specification', header: 'Specification' },
  { accessorKey: 'sourceRack', header: 'Source Rack' },
  { accessorKey: 'releasedQuantity', header: 'Released Quantity' },
  { accessorKey: 'supportReference', header: 'Support Ticket / Reference' },
  { accessorKey: 'createdBy', header: 'Created By' },
  { accessorKey: 'notes', header: 'Notes' },
]

useHead({ title: 'Stock-Out Report by Customer | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader
      title="Stock-Out Report by Customer"
      description="Review completed releases for one Customer."
    >
      <ReportsReportExportButton :href="report.exportUrl.value" :enabled="report.canExport.value" />
    </PageHeader>
    <ReportsReportFilters
      :model-value="report.filters"
      :definitions="filters"
      :loading="optionsLoading"
      :validation-message="report.validationMessage.value"
      @update:model-value="report.replaceFilters"
    />
    <ReportsReportTable
      v-model:page="report.page.value"
      :rows="report.rows.value"
      :columns="columns"
      :total="report.total.value"
      :page-size="report.pageSize"
      :loading="report.pending.value"
      :error="report.errorMessage.value"
      :ready="report.customerSelected.value"
    />
  </section>
</template>
