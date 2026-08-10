<script setup lang="ts">
import type { RackDto } from '#shared/types/masters'
import type { StockReleaseReturnableDto, StockReturnDto } from '#shared/types/transactions'
import type { StockReturnFormState } from '../../../components/transactions/forms'
import { mergeOptionsById } from '../../../components/transactions/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const resource = useTransactionResource<StockReturnDto>('/api/stock-returns')
const {
  data: record,
  pending,
  error,
  refresh,
} = useTransactionRecord<StockReturnDto>('/api/stock-returns', id)
const { data: racks } = useActiveMasterOptions<RackDto>('/api/racks')
const { data: eligible, refresh: refreshEligible } = useAsyncData(
  'eligible-stock-releases:detail',
  () => loadAllEligibleStockReleases(),
)
const state = ref<StockReturnFormState>({
  returnDate: '',
  stockReleaseId: '',
  notes: '',
  details: [],
})
const reviewOpen = ref(false)
const reviewAction = ref<'complete' | 'cancel'>('complete')
const draft = useDraftDirty(state)
const currentRelease = computed<StockReleaseReturnableDto | null>(() => {
  const value = record.value
  if (!value) return null
  return {
    id: value.stockRelease.id,
    transactionNumber: value.stockRelease.transactionNumber,
    releaseDate: value.stockRelease.releaseDate,
    engineerName: value.engineerName,
    customerId: value.customerId,
    customer: value.customer,
    details: value.details.map((detail) => ({
      stockReleaseDetailId: detail.stockReleaseDetailId,
      deviceDetailId: detail.deviceDetail.id,
      sourceRackId: detail.sourceRack.id,
      releasedQuantity: detail.releasedQuantity,
      completedReturnedQuantity: detail.previouslyReturnedQuantity,
      remainingReturnableQuantity: detail.remainingReturnableQuantity,
      deviceDetail: detail.deviceDetail,
      sourceRack: detail.sourceRack,
    })),
  }
})
const releaseOptions = computed(() => {
  const options = eligible.value?.data ?? []
  return currentRelease.value
    ? [currentRelease.value, ...options.filter((item) => item.id !== currentRelease.value?.id)]
    : options
})
const rackOptions = computed(() =>
  mergeOptionsById(
    racks.value ?? [],
    record.value?.details.map((detail) => detail.destinationRack) ?? [],
  ),
)

watch(
  record,
  (value) => {
    if (!value) return
    draft.hydrate({
      returnDate: value.returnDate.slice(0, 10),
      stockReleaseId: value.stockReleaseId,
      notes: value.notes ?? '',
      details: value.details.map((detail) => ({
        key: `detail-${detail.id}`,
        stockReleaseDetailId: detail.stockReleaseDetailId,
        destinationRackId: detail.destinationRackId,
        returnQuantity: detail.returnQuantity,
        notes: detail.notes ?? '',
      })),
    })
  },
  { immediate: true },
)
useHead({ title: 'Stock Return | Mini Inventory' })

async function save(body: Record<string, unknown>) {
  try {
    await resource.save(body, id.value)
    draft.markSaved()
    await refresh()
  } catch {
    // The composable retains server errors and the draft input for correction.
  }
}
function review(action: 'complete' | 'cancel') {
  if (action === 'complete' && draft.isDirty.value) return
  resource.actionError.value = ''
  reviewAction.value = action
  reviewOpen.value = true
}
async function confirm() {
  try {
    await resource.runAction(id.value, reviewAction.value)
    reviewOpen.value = false
  } catch {
    // Keep the review modal open with the server conflict message.
  } finally {
    await Promise.allSettled([refresh(), refreshEligible()])
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="Stock Return"
      description="Review returned quantities and their destination racks."
    >
      <TransactionsTransactionActions
        v-if="record"
        :status="record.status"
        :pending="resource.submitting.value"
        :complete-disabled="draft.isDirty.value"
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
      <TransactionsStockReturnForm
        v-model="state"
        :editable="record.status === 'DRAFT'"
        :racks="rackOptions"
        :eligible-releases="releaseOptions"
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
