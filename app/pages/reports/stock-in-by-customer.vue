<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { stockInByCustomerReportQuerySchema } from '#shared/schemas/reports'
import type { CustomerDto, DeviceDetailDto, DeviceDto, RackDto } from '#shared/types/masters'
import type { StockInReportRow } from '#shared/types/reports'
import type { ReportFilterDefinition } from '../../components/reports/ReportFilters.vue'

const report = useInventoryReport<StockInReportRow, Record<string, unknown>>({
  endpoint: '/api/reports/stock-in-by-customer',
  exportEndpoint: '/api/reports/stock-in-by-customer/export',
  schema: stockInByCustomerReportQuerySchema,
  customerRequired: true,
  initialFilters: {
    dateFrom: '',
    dateTo: '',
    customerId: '',
    deviceId: '',
    deviceDetailId: '',
    partNumber: '',
    dpn: '',
    rackId: '',
    stockInType: '',
  },
})
const customers = useReportMasterOptions<CustomerDto>('/api/customers')
const devices = useReportMasterOptions<DeviceDto>('/api/devices')
const deviceDetails = useReportMasterOptions<DeviceDetailDto>('/api/device-details')
const racks = useReportMasterOptions<RackDto>('/api/racks')
const optionsLoading = computed(() =>
  [customers, devices, deviceDetails, racks].some((resource) => resource.pending.value),
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
  {
    name: 'stockInType',
    label: 'Stock-In Type',
    kind: 'select',
    options: [
      { label: 'All Stock-In Types', value: '' },
      { label: 'Adjustment In', value: 'ADJUSTMENT_IN' },
      { label: 'Return', value: 'RETURN' },
    ],
  },
])
const columns: TableColumn<StockInReportRow>[] = [
  { accessorKey: 'transactionDate', header: 'Transaction Date' },
  { accessorKey: 'transactionNumber', header: 'Transaction Number' },
  { accessorKey: 'stockInType', header: 'Stock-In Type' },
  { accessorKey: 'device', header: 'Part' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'dpn', header: 'DP/N' },
  { accessorKey: 'specification', header: 'Specification' },
  { accessorKey: 'quantity', header: 'Quantity' },
  { accessorKey: 'rack', header: 'Rack' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'createdBy', header: 'Created By' },
  { accessorKey: 'notes', header: 'Notes' },
]

useHead({ title: 'Stock-In Report by Customer | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader
      title="Stock-In Report by Customer"
      description="Review completed incoming stock for one Customer."
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
