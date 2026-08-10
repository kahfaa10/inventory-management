<script setup lang="ts">
import type { CustomerDto, DeviceDetailDto, DeviceDto, RackDto } from '#shared/types/masters'
import type { StockAdjustmentInDto } from '#shared/types/transactions'
import type { AdjustmentInFormState } from '../../../components/transactions/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const resource = useTransactionResource<StockAdjustmentInDto>('/api/stock-adjustment-ins')
const {
  data: record,
  pending,
  error,
  refresh,
} = useTransactionRecord<StockAdjustmentInDto>('/api/stock-adjustment-ins', id)
const { data: customers } = useActiveMasterOptions<CustomerDto>('/api/customers')
const { data: devices } = useActiveMasterOptions<DeviceDto>('/api/devices')
const { data: deviceDetails } = useActiveMasterOptions<DeviceDetailDto>('/api/device-details')
const { data: racks } = useActiveMasterOptions<RackDto>('/api/racks')
const state = ref<AdjustmentInFormState>({
  transactionDate: '',
  customerId: null,
  notes: '',
  details: [],
})
const reviewOpen = ref(false)
const reviewAction = ref<'complete' | 'cancel'>('complete')

watch(
  record,
  (value) => {
    if (!value) return
    state.value = {
      transactionDate: value.transactionDate.slice(0, 10),
      customerId: value.customerId,
      notes: value.notes ?? '',
      details: value.details.map((detail) => ({
        key: `detail-${detail.id}`,
        deviceId: detail.deviceDetail.device.id,
        deviceDetailId: detail.deviceDetailId,
        destinationRackId: detail.destinationRackId,
        quantity: detail.quantity,
        notes: detail.notes ?? '',
      })),
    }
  },
  { immediate: true },
)
useHead({ title: 'Stock Adjustment In | Mini Inventory' })

async function save(body: Record<string, unknown>) {
  try {
    await resource.save(body, id.value)
    await refresh()
  } catch {
    // The composable retains server errors and the draft input for correction.
  }
}
function review(action: 'complete' | 'cancel') {
  resource.actionError.value = ''
  reviewAction.value = action
  reviewOpen.value = true
}
async function confirm() {
  try {
    await resource.runAction(id.value, reviewAction.value)
    reviewOpen.value = false
    await refresh()
  } catch {
    // Keep the review modal open with the server conflict message.
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="Stock Adjustment In"
      description="Review the transaction and its inventory effect."
    >
      <TransactionsTransactionActions
        v-if="record"
        :status="record.status"
        :pending="resource.submitting.value"
        @edit="() => undefined"
        @complete="review('complete')"
        @cancel="review('cancel')"
      />
    </PageHeader>
    <UAlert
      v-if="error"
      color="error"
      title="Transaction could not be loaded"
      :description="error.message"
    />
    <p v-else-if="pending" role="status">Loading transaction…</p>
    <template v-else-if="record">
      <div class="mb-4 flex items-center gap-3">
        <span class="font-mono font-medium">{{ record.transactionNumber }}</span>
        <TransactionsTransactionStatusBadge :status="record.status" />
      </div>
      <UAlert
        v-if="resource.actionError.value"
        color="error"
        title="Transaction could not be updated"
        :description="resource.actionError.value"
      />
      <TransactionsAdjustmentInForm
        v-model="state"
        :editable="record.status === 'DRAFT'"
        :customers="customers || []"
        :devices="devices || []"
        :device-details="deviceDetails || []"
        :racks="racks || []"
        :field-errors="resource.fieldErrors.value"
        :submitting="resource.submitting.value"
        @submit="save"
      />
    </template>
    <TransactionsTransactionReviewModal
      v-model:open="reviewOpen"
      :action="reviewAction"
      :transaction-number="record?.transactionNumber"
      :pending="resource.submitting.value"
      :error="resource.actionError.value"
      @confirm="confirm"
    />
  </section>
</template>
