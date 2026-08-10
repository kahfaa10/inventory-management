<script setup lang="ts">
import type { CustomerDto, DeviceDetailDto, DeviceDto, RackDto } from '#shared/types/masters'
import type { AdjustmentInFormState } from '../../../components/transactions/forms'
import { jakartaCalendarDate } from '../../../utils/jakartaDate'

const resource = useTransactionResource('/api/stock-adjustment-ins')
const state = ref<AdjustmentInFormState>({
  transactionDate: jakartaCalendarDate(),
  customerId: null,
  notes: '',
  details: [],
})
const {
  data: customers,
  pending: customersPending,
  error: customersError,
} = useActiveMasterOptions<CustomerDto>('/api/customers')
const {
  data: devices,
  pending: devicesPending,
  error: devicesError,
} = useActiveMasterOptions<DeviceDto>('/api/devices')
const {
  data: deviceDetails,
  pending: detailsPending,
  error: detailsError,
} = useActiveMasterOptions<DeviceDetailDto>('/api/device-details')
const {
  data: racks,
  pending: racksPending,
  error: racksError,
} = useActiveMasterOptions<RackDto>('/api/racks')
const loadingOptions = computed(
  () =>
    customersPending.value || devicesPending.value || detailsPending.value || racksPending.value,
)
const optionError = computed(
  () =>
    customersError.value?.message ||
    devicesError.value?.message ||
    detailsError.value?.message ||
    racksError.value?.message,
)

useHead({ title: 'New Stock Adjustment In | Mini Inventory' })

async function submit(body: Record<string, unknown>) {
  try {
    const record = await resource.save(body)
    if (record) await navigateTo(`/transactions/stock-adjustment-ins/${record.id}`)
  } catch {
    // The composable retains server errors and the form state for correction.
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="New Stock Adjustment In"
      description="Create and review an incoming stock draft."
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
    <TransactionsAdjustmentInForm
      v-if="!optionError && !loadingOptions"
      v-model="state"
      editable
      :customers="customers || []"
      :devices="devices || []"
      :device-details="deviceDetails || []"
      :racks="racks || []"
      :field-errors="resource.fieldErrors.value"
      :submitting="resource.submitting.value"
      @submit="submit"
    />
  </section>
</template>
