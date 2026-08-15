<script setup lang="ts">
import { stockAdjustmentInCreateSchema } from '#shared/schemas/stock-adjustment-in'
import type {
  AdjustmentInFormState,
  CustomerOption,
  DeviceDetailOption,
  DeviceOption,
  RackOption,
} from './forms'
import { cloneForm, localKey } from './forms'

const props = defineProps<{
  modelValue: AdjustmentInFormState
  editable: boolean
  customers: CustomerOption[]
  devices: DeviceOption[]
  deviceDetails: DeviceDetailOption[]
  racks: RackOption[]
  fieldErrors?: Record<string, string[]>
  submitting?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: AdjustmentInFormState]
  submit: [value: Record<string, unknown>]
}>()
const state = reactive(cloneForm(props.modelValue))
watch(
  () => props.modelValue,
  (value) => Object.assign(state, cloneForm(value)),
  { deep: true },
)
const option = (label: string, value: string | null) => ({ label, value })
const customerItems = computed(() => [
  option('No customer', null),
  ...props.customers.map((item) => option(item.customerName, item.id)),
])
const deviceItems = computed(() => props.devices.map((item) => option(item.deviceName, item.id)))
const rackItems = computed(() =>
  props.racks.map((item) => option(`${item.rackCode} — ${item.rackName}`, item.id)),
)
const detailItems = (deviceId: string) =>
  props.deviceDetails
    .filter((item) => item.deviceId === deviceId)
    .map((item) =>
      option(
        `${item.partNumber}${item.dpn ? ` / ${item.dpn}` : ''} — ${item.specification}`,
        item.id,
      ),
    )
const payload = computed(() => ({
  transactionDate: state.transactionDate,
  customerId: state.customerId || null,
  notes: state.notes,
  details: state.details.map(({ deviceDetailId, destinationRackId, quantity, notes }) => ({
    deviceDetailId,
    destinationRackId,
    quantity,
    notes,
  })),
}))

function publish() {
  emit('update:modelValue', cloneForm(state))
}
function setHeader(field: 'transactionDate' | 'customerId' | 'notes', value: string) {
  if (field === 'customerId') state.customerId = value || null
  else state[field] = value
  publish()
}
function setDetail(index: number, values: Partial<(typeof state.details)[number]>) {
  Object.assign(state.details[index]!, values)
  publish()
}
function setDevice(index: number, deviceId: string) {
  setDetail(index, { deviceId, deviceDetailId: '' })
}
function addDetail() {
  state.details.push({
    key: localKey(),
    deviceId: '',
    deviceDetailId: '',
    destinationRackId: '',
    quantity: 1,
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
    :schema="stockAdjustmentInCreateSchema"
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
      <UFormField
        label="Transaction Date"
        name="transactionDate"
        required
        :error="fieldErrors?.transactionDate?.[0]"
      >
        <UInput
          :model-value="state.transactionDate"
          type="date"
          :disabled="!editable"
          @update:model-value="setHeader('transactionDate', String($event))"
        />
      </UFormField>
      <UFormField label="Customer" name="customerId" :error="fieldErrors?.customerId?.[0]">
        <USelect
          :model-value="state.customerId"
          :items="customerItems"
          :disabled="!editable"
          @update:model-value="setHeader('customerId', String($event || ''))"
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
      @add="addDetail"
      @remove="removeDetail"
    >
      <template #default="{ row, index }">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UFormField label="Device">
            <USelect
              :model-value="row.deviceId"
              :items="deviceItems"
              :disabled="!editable"
              :aria-label="`Device row ${index + 1}`"
              @update:model-value="setDevice(index, String($event))"
            />
          </UFormField>
          <UFormField
            label="Device Detail"
            :name="`details.${index}.deviceDetailId`"
            :error="fieldErrors?.[`details.${index}.deviceDetailId`]?.[0]"
          >
            <USelect
              :model-value="row.deviceDetailId"
              :items="detailItems(row.deviceId)"
              :disabled="!editable || !row.deviceId"
              :aria-label="`Device Detail row ${index + 1}`"
              @update:model-value="setDetail(index, { deviceDetailId: String($event) })"
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
            label="Quantity"
            :name="`details.${index}.quantity`"
            :error="fieldErrors?.[`details.${index}.quantity`]?.[0]"
          >
            <UInput
              :model-value="row.quantity"
              type="number"
              min="1"
              :disabled="!editable"
              :aria-label="`Quantity row ${index + 1}`"
              @update:model-value="setDetail(index, { quantity: Number($event) })"
            />
          </UFormField>
          <UFormField
            label="Detail Notes"
            :name="`details.${index}.notes`"
            :error="fieldErrors?.[`details.${index}.notes`]?.[0]"
            class="md:col-span-2 xl:col-span-4"
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
