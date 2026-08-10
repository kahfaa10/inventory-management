<script setup lang="ts">
import { stockReleaseCreateSchema } from '#shared/schemas/stock-release'
import type {
  CustomerOption,
  DeviceDetailOption,
  DeviceOption,
  ModelOption,
  RackOption,
  ServiceTagOption,
  StockReleaseFormState,
} from './forms'
import { cloneForm, localKey } from './forms'

const props = defineProps<{
  modelValue: StockReleaseFormState
  editable: boolean
  customers: CustomerOption[]
  devices: DeviceOption[]
  deviceDetails: DeviceDetailOption[]
  racks: RackOption[]
  models: ModelOption[]
  serviceTags: ServiceTagOption[]
  fieldErrors?: Record<string, string[]>
  submitting?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: StockReleaseFormState]
  submit: [value: Record<string, unknown>]
}>()
const state = reactive(cloneForm(props.modelValue))
const availability = useStockAvailability()
watch(
  () => props.modelValue,
  (value) => Object.assign(state, cloneForm(value)),
  { deep: true },
)

const option = (label: string, value: string | null) => ({ label, value })
const customerItems = computed(() =>
  props.customers.map((item) => option(item.customerName, item.id)),
)
const deviceItems = computed(() => props.devices.map((item) => option(item.deviceName, item.id)))
const rackItems = (row: StockReleaseFormState['details'][number]) =>
  props.racks
    .filter((item) => {
      const balance = availability.balance(row.deviceDetailId, item.id)
      return (balance !== undefined && balance > 0) || item.id === row.sourceRackId
    })
    .map((item) => ({
      ...option(`${item.rackCode} — ${item.rackName}`, item.id),
      disabled: (availability.balance(row.deviceDetailId, item.id) ?? 0) <= 0,
    }))
const modelItems = computed(() => [
  option('No model', null),
  ...props.models.map((item) => option(item.modelName, item.id)),
])
const serviceTagItems = computed(() => [
  option('No service tag', null),
  ...props.serviceTags
    .filter(
      (item) =>
        item.id === state.serviceTagId ||
        (item.modelId === state.modelId && item.customerId === state.customerId),
    )
    .map((item) => option(item.serviceTag, item.id)),
])
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
  releaseDate: state.releaseDate,
  engineerName: state.engineerName,
  customerId: state.customerId,
  modelId: state.modelId || null,
  serviceTagId: state.serviceTagId || null,
  referenceNumber: state.referenceNumber,
  notes: state.notes,
  details: state.details.map(({ deviceDetailId, sourceRackId, releasedQuantity, notes }) => ({
    deviceDetailId,
    sourceRackId,
    releasedQuantity,
    notes,
  })),
}))

function publish() {
  emit('update:modelValue', cloneForm(state))
}
function setHeader(field: keyof Omit<StockReleaseFormState, 'details'>, value: string) {
  if (field === 'modelId' || field === 'serviceTagId') state[field] = value || null
  else state[field] = value
  if (field === 'customerId' || field === 'modelId') state.serviceTagId = null
  publish()
}
async function refreshAvailability(index: number, force = false) {
  const row = state.details[index]
  await availability.refreshRacks(
    row?.deviceDetailId,
    props.racks.map((rack) => rack.id),
    force,
  )
}
function setDetail(index: number, values: Partial<(typeof state.details)[number]>) {
  Object.assign(state.details[index]!, values)
  publish()
}
function setDevice(index: number, deviceId: string) {
  setDetail(index, { deviceId, deviceDetailId: '', sourceRackId: '' })
}
function setDeviceDetail(index: number, deviceDetailId: string) {
  setDetail(index, { deviceDetailId, sourceRackId: '' })
  void refreshAvailability(index)
}
function addDetail() {
  state.details.push({
    key: localKey(),
    deviceId: '',
    deviceDetailId: '',
    sourceRackId: '',
    releasedQuantity: 1,
    notes: '',
  })
  publish()
}
function removeDetail(index: number) {
  state.details.splice(index, 1)
  publish()
}

onMounted(() => {
  for (const [index] of state.details.entries()) void refreshAvailability(index)
})
watch(
  () => props.racks.map((rack) => rack.id).join(','),
  () => {
    for (const [index] of state.details.entries()) void refreshAvailability(index)
  },
)

defineExpose({
  refreshAvailability: () =>
    Promise.all(state.details.map((_, index) => refreshAvailability(index, true))),
})
</script>

<template>
  <UForm
    :schema="stockReleaseCreateSchema"
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
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <UFormField label="Release Date" name="releaseDate" :error="fieldErrors?.releaseDate?.[0]">
        <UInput
          :model-value="state.releaseDate"
          type="date"
          :disabled="!editable"
          @update:model-value="setHeader('releaseDate', String($event))"
        />
      </UFormField>
      <UFormField label="Engineer Name" name="engineerName" :error="fieldErrors?.engineerName?.[0]">
        <UInput
          :model-value="state.engineerName"
          :disabled="!editable"
          @update:model-value="setHeader('engineerName', String($event))"
        />
      </UFormField>
      <UFormField label="Customer" name="customerId" :error="fieldErrors?.customerId?.[0]">
        <USelect
          :model-value="state.customerId"
          :items="customerItems"
          :disabled="!editable"
          @update:model-value="setHeader('customerId', String($event))"
        />
      </UFormField>
      <UFormField label="Model" name="modelId" :error="fieldErrors?.modelId?.[0]">
        <USelect
          :model-value="state.modelId"
          :items="modelItems"
          :disabled="!editable"
          @update:model-value="setHeader('modelId', String($event || ''))"
        />
      </UFormField>
      <UFormField label="Service Tag" name="serviceTagId" :error="fieldErrors?.serviceTagId?.[0]">
        <USelect
          aria-label="Service Tag"
          :model-value="state.serviceTagId"
          :items="serviceTagItems"
          :disabled="!editable || !state.modelId || !state.customerId"
          @update:model-value="setHeader('serviceTagId', String($event || ''))"
        />
      </UFormField>
      <UFormField
        label="Reference Number"
        name="referenceNumber"
        :error="fieldErrors?.referenceNumber?.[0]"
      >
        <UInput
          :model-value="state.referenceNumber"
          :disabled="!editable"
          @update:model-value="setHeader('referenceNumber', String($event))"
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
              @update:model-value="setDeviceDetail(index, String($event))"
            />
          </UFormField>
          <UFormField
            label="Source Rack"
            :name="`details.${index}.sourceRackId`"
            :error="fieldErrors?.[`details.${index}.sourceRackId`]?.[0]"
          >
            <USelect
              :model-value="row.sourceRackId"
              :items="rackItems(row)"
              :disabled="
                !editable || !row.deviceDetailId || availability.isDevicePending(row.deviceDetailId)
              "
              :aria-label="`Source Rack row ${index + 1}`"
              @update:model-value="setDetail(index, { sourceRackId: String($event) })"
            />
          </UFormField>
          <UFormField
            label="Released Quantity"
            :name="`details.${index}.releasedQuantity`"
            :error="fieldErrors?.[`details.${index}.releasedQuantity`]?.[0]"
          >
            <UInput
              :model-value="row.releasedQuantity"
              type="number"
              min="1"
              :disabled="!editable"
              :aria-label="`Released Quantity row ${index + 1}`"
              @update:model-value="setDetail(index, { releasedQuantity: Number($event) })"
            />
          </UFormField>
          <div class="text-sm md:col-span-2 xl:col-span-4" aria-live="polite">
            <span v-if="availability.isDevicePending(row.deviceDetailId)">
              Loading racks with available stock…
            </span>
            <span
              v-else-if="availability.balance(row.deviceDetailId, row.sourceRackId) !== undefined"
              class="font-medium"
            >
              Available: {{ availability.balance(row.deviceDetailId, row.sourceRackId) }}
            </span>
            <span
              v-if="availability.deviceError(row.deviceDetailId)"
              role="alert"
              class="text-error"
            >
              {{ availability.deviceError(row.deviceDetailId) }}
            </span>
          </div>
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
