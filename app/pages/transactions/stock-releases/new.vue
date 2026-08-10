<script setup lang="ts">
import type {
  CustomerDto,
  DeviceDetailDto,
  DeviceDto,
  ModelDto,
  RackDto,
  ServiceTagDto,
} from '#shared/types/masters'
import type { StockReleaseFormState } from '../../../components/transactions/forms'

const resource = useTransactionResource('/api/stock-releases')
const state = ref<StockReleaseFormState>({
  releaseDate: new Date().toISOString().slice(0, 10),
  engineerName: '',
  customerId: '',
  modelId: null,
  serviceTagId: null,
  referenceNumber: '',
  notes: '',
  details: [],
})
const optionRequests = [
  useActiveMasterOptions<CustomerDto>('/api/customers'),
  useActiveMasterOptions<DeviceDto>('/api/devices'),
  useActiveMasterOptions<DeviceDetailDto>('/api/device-details'),
  useActiveMasterOptions<RackDto>('/api/racks'),
  useActiveMasterOptions<ModelDto>('/api/models'),
  useActiveMasterOptions<ServiceTagDto>('/api/service-tags'),
] as const
const [customersRequest, devicesRequest, detailsRequest, racksRequest, modelsRequest, tagsRequest] =
  optionRequests
const customers = customersRequest.data
const devices = devicesRequest.data
const deviceDetails = detailsRequest.data
const racks = racksRequest.data
const models = modelsRequest.data
const serviceTags = tagsRequest.data
const loadingOptions = computed(() => optionRequests.some((request) => request.pending.value))
const optionError = computed(() =>
  optionRequests.map((request) => request.error.value?.message).find(Boolean),
)

useHead({ title: 'New Stock Release | Mini Inventory' })
async function submit(body: Record<string, unknown>) {
  try {
    const record = await resource.save(body)
    if (record) await navigateTo(`/transactions/stock-releases/${record.id}`)
  } catch {
    // The composable retains server errors and the form state for correction.
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="New Stock Release"
      description="Create and review an engineer release draft."
    />
    <UAlert
      v-if="optionError"
      color="error"
      title="Options could not be loaded"
      :description="optionError"
    />
    <p v-else-if="loadingOptions" role="status">Loading form options…</p>
    <UAlert
      v-if="resource.actionError.value"
      color="error"
      title="Draft could not be saved"
      :description="resource.actionError.value"
    />
    <TransactionsStockReleaseForm
      v-if="!optionError && !loadingOptions"
      v-model="state"
      editable
      :customers="customers || []"
      :devices="devices || []"
      :device-details="deviceDetails || []"
      :racks="racks || []"
      :models="models || []"
      :service-tags="serviceTags || []"
      :field-errors="resource.fieldErrors.value"
      :submitting="resource.submitting.value"
      @submit="submit"
    />
  </section>
</template>
