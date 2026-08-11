<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { stockCardReportQuerySchema } from '#shared/schemas/reports'
import type { DeviceDetailDto, DeviceDto, RackDto } from '#shared/types/masters'
import type { StockCardReportRow } from '#shared/types/reports'
import type { ReportFilterDefinition } from '../../components/reports/ReportFilters.vue'

const report = useInventoryReport<StockCardReportRow, Record<string, unknown>>({
  endpoint: '/api/reports/stock-card',
  exportEndpoint: '/api/reports/stock-card/export',
  schema: stockCardReportQuerySchema,
  initialFilters: {
    dateFrom: '',
    dateTo: '',
    deviceId: '',
    deviceDetailId: '',
    partNumber: '',
    dpn: '',
    rackId: '',
    transactionType: '',
  },
})
const devices = useReportMasterOptions<DeviceDto>('/api/devices')
const deviceDetails = useReportMasterOptions<DeviceDetailDto>('/api/device-details')
const racks = useReportMasterOptions<RackDto>('/api/racks')
const optionsLoading = computed(
  () => devices.pending.value || deviceDetails.pending.value || racks.pending.value,
)
const filters = computed<ReportFilterDefinition[]>(() => [
  { name: 'dateFrom', label: 'Date From', kind: 'date' },
  { name: 'dateTo', label: 'Date To', kind: 'date' },
  {
    name: 'deviceId',
    label: 'Part',
    kind: 'select',
    options: [
      { label: 'All Parts', value: '' },
      ...(devices.data.value ?? []).map((item) => ({
        label: item.isActive ? item.deviceName : `${item.deviceName} (Inactive)`,
        value: item.id,
      })),
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
        .map((item) => ({
          label: `${item.partNumber} — ${item.specification}${item.isActive ? '' : ' (Inactive)'}`,
          value: item.id,
        })),
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
        label: `${item.rackCode} — ${item.rackName}${item.isActive ? '' : ' (Inactive)'}`,
        value: item.id,
      })),
    ],
  },
  {
    name: 'transactionType',
    label: 'Transaction Type',
    kind: 'select',
    options: [
      { label: 'All Transaction Types', value: '' },
      { label: 'Stock Adjustment In', value: 'STOCK_ADJUSTMENT_IN' },
      { label: 'Stock Release', value: 'STOCK_RELEASE' },
      { label: 'Stock Return', value: 'STOCK_RETURN' },
    ],
  },
])
const columns: TableColumn<StockCardReportRow>[] = [
  { accessorKey: 'transactionDate', header: 'Transaction Date' },
  { accessorKey: 'transactionNumber', header: 'Transaction Number' },
  { accessorKey: 'transactionType', header: 'Transaction Type' },
  { accessorKey: 'device', header: 'Part' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'dpn', header: 'DP/N' },
  { accessorKey: 'specification', header: 'Specification' },
  { accessorKey: 'rack', header: 'Rack' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'engineerName', header: 'Engineer Name' },
  { accessorKey: 'quantityIn', header: 'Quantity In' },
  { accessorKey: 'quantityOut', header: 'Quantity Out' },
  { accessorKey: 'runningBalance', header: 'Running Balance' },
  { accessorKey: 'notes', header: 'Notes' },
]

useHead({ title: 'Stock Card Report | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader
      title="Stock Card Report"
      description="Review chronological inventory movements and running balances."
    >
      <ReportsReportExportButton :href="report.exportUrl.value" :enabled="report.canExport.value" />
    </PageHeader>
    <ReportsReportFilters
      :model-value="report.filters"
      :definitions="filters"
      :loading="optionsLoading"
      :validation-message="report.validationMessage.value"
      @update:model-value="report.replaceFilters"
      @clear="report.clearFilters"
    />
    <ReportsReportTable
      v-model:page="report.page.value"
      :rows="report.rows.value"
      :columns="columns"
      :total="report.total.value"
      :page-size="report.pageSize"
      :loading="report.pending.value"
      :error="report.errorMessage.value"
    />
  </section>
</template>
