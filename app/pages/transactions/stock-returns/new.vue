<script setup lang="ts">
import type { RackDto } from '#shared/types/masters'
import type { StockReturnFormState } from '../../../components/transactions/forms'
import { jakartaCalendarDate } from '../../../utils/jakartaDate'

const resource = useTransactionResource('/api/stock-returns')
const state = ref<StockReturnFormState>({
  returnDate: jakartaCalendarDate(),
  stockReleaseId: '',
  notes: '',
  details: [],
})
const {
  data: racks,
  pending: racksPending,
  error: racksError,
} = useActiveMasterOptions<RackDto>('/api/racks')
const {
  data: eligible,
  pending,
  error,
} = useAsyncData('eligible-stock-releases:new', () => loadAllEligibleStockReleases())
useHead({ title: 'New Stock Return | Mini Inventory' })

async function submit(body: Record<string, unknown>) {
  try {
    const record = await resource.save(body)
    if (record) await navigateTo(`/transactions/stock-returns/${record.id}`)
  } catch {
    // The composable retains server errors and the form state for correction.
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="New Stock Return"
      description="Create a return from an eligible completed release."
    />
    <UAlert
      v-if="error || racksError"
      color="error"
      title="Eligible releases could not be loaded"
      :description="error?.message || racksError?.message"
    />
    <p v-else-if="pending || racksPending" role="status">Loading eligible releases…</p>
    <UAlert
      v-if="resource.actionError.value"
      color="error"
      title="Draft could not be saved"
      :description="resource.actionError.value"
    />
    <TransactionsStockReturnForm
      v-if="!error && !racksError && !pending && !racksPending"
      v-model="state"
      editable
      :racks="racks || []"
      :eligible-releases="eligible?.data || []"
      :field-errors="resource.fieldErrors.value"
      :submitting="resource.submitting.value"
      @submit="submit"
    />
  </section>
</template>
