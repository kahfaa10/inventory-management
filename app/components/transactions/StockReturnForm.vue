<script setup lang="ts">
import { stockReturnCreateSchema } from '#shared/schemas/stock-return'
import type { EligibleReleaseOption, RackOption, StockReturnFormState } from './forms'
import { cloneForm, localKey } from './forms'

const props = defineProps<{
  modelValue: StockReturnFormState
  editable: boolean
  racks: RackOption[]
  eligibleReleases: EligibleReleaseOption[]
  fieldErrors?: Record<string, string[]>
  submitting?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: StockReturnFormState]
  submit: [value: Record<string, unknown>]
}>()
const state = reactive(cloneForm(props.modelValue))
watch(
  () => props.modelValue,
  (value) => Object.assign(state, cloneForm(value)),
  { deep: true },
)

const option = (label: string, value: string) => ({ label, value })
const releaseItems = computed(() =>
  props.eligibleReleases.map((release) =>
    option(`${release.transactionNumber} — ${release.releaseDate.slice(0, 10)}`, release.id),
  ),
)
const rackItems = computed(() =>
  props.racks.map((item) => option(`${item.rackCode} — ${item.rackName}`, item.id)),
)
const selectedRelease = computed(() =>
  props.eligibleReleases.find((release) => release.id === state.stockReleaseId),
)
const releasedItems = computed(() =>
  (selectedRelease.value?.details ?? []).map((detail) =>
    option(
      `${detail.deviceDetail.partNumber} — remaining ${detail.remainingReturnableQuantity}`,
      detail.stockReleaseDetailId,
    ),
  ),
)
const releaseDetail = (id: string) =>
  selectedRelease.value?.details.find((detail) => detail.stockReleaseDetailId === id)
const payload = computed(() => ({
  returnDate: state.returnDate,
  stockReleaseId: state.stockReleaseId,
  notes: state.notes,
  details: state.details.map(
    ({ stockReleaseDetailId, destinationRackId, returnQuantity, notes }) => ({
      stockReleaseDetailId,
      destinationRackId,
      returnQuantity,
      notes,
    }),
  ),
}))

function publish() {
  emit('update:modelValue', cloneForm(state))
}
function setHeader(field: 'returnDate' | 'notes', value: string) {
  state[field] = value
  publish()
}
function selectRelease(id: string) {
  state.stockReleaseId = id
  const release = props.eligibleReleases.find((item) => item.id === id)
  state.details = (release?.details ?? []).map((detail) => ({
    key: localKey(),
    stockReleaseDetailId: detail.stockReleaseDetailId,
    destinationRackId: '',
    returnQuantity: 1,
    notes: '',
  }))
  publish()
}
function setDetail(index: number, values: Partial<(typeof state.details)[number]>) {
  Object.assign(state.details[index]!, values)
  publish()
}
function addDetail() {
  state.details.push({
    key: localKey(),
    stockReleaseDetailId: '',
    destinationRackId: '',
    returnQuantity: 1,
    notes: '',
  })
  publish()
}
function removeDetail(index: number) {
  state.details.splice(index, 1)
  publish()
}
</script>

<template>
  <UForm
    :schema="stockReturnCreateSchema"
    :state="payload"
    class="space-y-6"
    @submit="emit('submit', payload)"
  >
    <UAlert
      v-if="fieldErrors?._form?.[0]"
      color="error"
      title="Please review the transaction"
      :description="fieldErrors._form[0]"
    />
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Return Date" name="returnDate" :error="fieldErrors?.returnDate?.[0]">
        <UInput
          :model-value="state.returnDate"
          type="date"
          :disabled="!editable"
          @update:model-value="setHeader('returnDate', String($event))"
        />
      </UFormField>
      <UFormField
        label="Original Stock Release"
        name="stockReleaseId"
        :error="fieldErrors?.stockReleaseId?.[0]"
      >
        <USelect
          :model-value="state.stockReleaseId"
          :items="releaseItems"
          :disabled="!editable"
          aria-label="Original Stock Release"
          @update:model-value="selectRelease(String($event))"
        />
      </UFormField>
      <UFormField label="Engineer Name">
        <UInput
          aria-label="Engineer Name"
          :model-value="selectedRelease?.engineerName || ''"
          readonly
        />
      </UFormField>
      <UFormField label="Customer">
        <UInput
          aria-label="Customer"
          :model-value="selectedRelease?.customer.customerName || ''"
          readonly
        />
      </UFormField>
    </div>
    <UFormField label="Notes" name="notes" :error="fieldErrors?.notes?.[0]">
      <UTextarea
        :model-value="state.notes"
        :disabled="!editable"
        @update:model-value="setHeader('notes', String($event))"
      />
    </UFormField>

    <TransactionsDetailRowsEditor
      :rows="state.details"
      :editable="editable"
      empty-text="Select an eligible Stock Release to load returnable details."
      @add="addDetail"
      @remove="removeDetail"
    >
      <template #default="{ row, index }">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UFormField
            label="Released Item"
            :name="`details.${index}.stockReleaseDetailId`"
            :error="fieldErrors?.[`details.${index}.stockReleaseDetailId`]?.[0]"
          >
            <USelect
              :model-value="row.stockReleaseDetailId"
              :items="releasedItems"
              :disabled="!editable || !state.stockReleaseId"
              :aria-label="`Released Item row ${index + 1}`"
              @update:model-value="setDetail(index, { stockReleaseDetailId: String($event) })"
            />
          </UFormField>
          <UFormField
            label="Destination Rack"
            :name="`details.${index}.destinationRackId`"
            :error="fieldErrors?.[`details.${index}.destinationRackId`]?.[0]"
          >
            <USelect
              :model-value="row.destinationRackId"
              :items="rackItems"
              :disabled="!editable"
              :aria-label="`Destination Rack row ${index + 1}`"
              @update:model-value="setDetail(index, { destinationRackId: String($event) })"
            />
          </UFormField>
          <UFormField
            label="Return Quantity"
            :name="`details.${index}.returnQuantity`"
            :error="fieldErrors?.[`details.${index}.returnQuantity`]?.[0]"
          >
            <UInput
              :model-value="row.returnQuantity"
              type="number"
              min="1"
              :max="releaseDetail(row.stockReleaseDetailId)?.remainingReturnableQuantity"
              :disabled="!editable"
              :aria-label="`Return Quantity row ${index + 1}`"
              @update:model-value="setDetail(index, { returnQuantity: Number($event) })"
            />
          </UFormField>
          <div
            v-if="releaseDetail(row.stockReleaseDetailId)"
            class="flex flex-wrap gap-4 text-sm md:col-span-2 xl:col-span-3"
          >
            <span>Released: {{ releaseDetail(row.stockReleaseDetailId)?.releasedQuantity }}</span>
            <span>
              Previously returned:
              {{ releaseDetail(row.stockReleaseDetailId)?.completedReturnedQuantity }}
            </span>
            <span class="font-medium">
              Remaining: {{ releaseDetail(row.stockReleaseDetailId)?.remainingReturnableQuantity }}
            </span>
          </div>
          <UFormField
            label="Detail Notes"
            :name="`details.${index}.notes`"
            :error="fieldErrors?.[`details.${index}.notes`]?.[0]"
            class="md:col-span-2 xl:col-span-3"
          >
            <UTextarea
              :model-value="row.notes"
              :disabled="!editable"
              @update:model-value="setDetail(index, { notes: String($event) })"
            />
          </UFormField>
        </div>
      </template>
    </TransactionsDetailRowsEditor>
    <div v-if="editable" class="flex justify-end">
      <UButton label="Save Draft" type="submit" :loading="submitting" />
    </div>
  </UForm>
</template>
