<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { deviceDetailCreateSchema, deviceDetailUpdateSchema } from '#shared/schemas/masters'
import type { DeviceDetailDto, DeviceDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<DeviceDetailDto>('/api/device-details', ['deviceId'])
const modalOpen = ref(false)
const editingId = ref<string>()
const selectedRecord = ref<DeviceDetailDto>()
const state = reactive({
  deviceId: '',
  partNumber: '',
  dpn: '',
  specification: '',
  description: '',
  isActive: true,
})
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'device.deviceName', header: 'Part' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'dpn', header: 'DP/N' },
  { accessorKey: 'specification', header: 'Specification' },
]
const {
  data: devices,
  pending: devicesPending,
  error: devicesError,
} = useActiveMasterOptions<DeviceDto>('/api/devices')
const deviceOptions = computed(() => {
  const options = (devices.value ?? []).map((item) => ({
    label: item.deviceName,
    value: item.id,
  }))
  const current = selectedRecord.value?.device
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({
      label: current.isActive ? current.deviceName : `${current.deviceName} (Inactive)`,
      value: current.id,
    })
  }
  return options
})
const deviceFilterOptions = computed(() => [
  ...(devices.value ?? []).map((item) => ({ label: item.deviceName, value: item.id })),
])

useHead({ title: 'Part Details | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  selectedRecord.value = undefined
  Object.assign(state, {
    deviceId: '',
    partNumber: '',
    dpn: '',
    specification: '',
    description: '',
    isActive: true,
  })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as DeviceDetailDto
  editingId.value = row.id
  selectedRecord.value = row
  Object.assign(state, {
    deviceId: row.deviceId,
    partNumber: row.partNumber,
    dpn: row.dpn ?? '',
    specification: row.specification,
    description: row.description ?? '',
    isActive: row.isActive,
  })
  modalOpen.value = true
}

async function submit() {
  await resource.save(editingId.value, { ...state })
  modalOpen.value = false
}
</script>

<template>
  <section>
    <PageHeader
      title="Part Details"
      description="Manage inventory items and their part specifications."
    />
    <UAlert
      v-if="devicesError"
      class="mb-4"
      color="error"
      variant="soft"
      title="Unable to load active Part options"
      description="Refresh the page before creating or editing a Part Detail."
    />
    <MastersMasterList
      v-model:search="resource.search.value"
      v-model:active-filter="resource.activeFilter.value"
      v-model:page="resource.page.value"
      :rows="resource.rows.value"
      :columns="columns"
      :loading="resource.pending.value"
      :total="resource.total.value"
      :page-size="resource.pageSize"
      :can-write="resource.canWrite.value"
      @create="createRecord"
      @edit="editRecord"
      @toggle="resource.toggle($event as DeviceDetailDto)"
    >
      <template #filters>
        <USelect
          v-model="resource.filters.deviceId"
          :items="deviceFilterOptions"
          placeholder="All parts"
          aria-label="Filter by part"
          class="w-44"
          :loading="devicesPending"
          :disabled="devicesPending || !!devicesError"
        />
      </template>
    </MastersMasterList>
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Part Detail' : 'Create Part Detail'"
      :schema="editingId ? deviceDetailUpdateSchema : deviceDetailCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Part" name="deviceId" required>
        <USelect
          v-model="state.deviceId"
          :items="deviceOptions"
          class="w-full"
          :loading="devicesPending"
          :disabled="devicesPending || !!devicesError"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Part Number" name="partNumber" required>
          <UInput v-model="state.partNumber" class="w-full" />
        </UFormField>
        <UFormField label="DP/N" name="dpn">
          <UInput v-model="state.dpn" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Specification" name="specification" required>
        <UTextarea v-model="state.specification" class="w-full" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive"><USwitch v-model="state.isActive" /></UFormField>
    </MastersMasterFormModal>
  </section>
</template>
