<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PaginatedResponse } from '#shared/types/api'
import { deviceDetailCreateSchema, deviceDetailUpdateSchema } from '#shared/schemas/masters'
import type { DeviceDetailDto, DeviceDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<DeviceDetailDto>('/api/device-details')
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
  { accessorKey: 'device.deviceName', header: 'Device' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'dpn', header: 'DP/N' },
  { accessorKey: 'specification', header: 'Specification' },
]
const { data: devices } = useFetch<PaginatedResponse<DeviceDto>>('/api/devices', {
  query: { isActive: true, pageSize: 100 },
})
const deviceOptions = computed(() => {
  const options = (devices.value?.data ?? []).map((item) => ({
    label: item.deviceName,
    value: item.id,
  }))
  const current = selectedRecord.value?.device
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({ label: `${current.deviceName} (Inactive)`, value: current.id })
  }
  return options
})
const deviceFilterOptions = computed(() => [
  { label: 'All devices', value: '' },
  ...deviceOptions.value,
])

useHead({ title: 'Device Details | Mini Inventory' })

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
      title="Device Details"
      description="Manage inventory items and their part specifications."
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
          aria-label="Filter by device"
          class="w-44"
        />
      </template>
    </MastersMasterList>
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Device Detail' : 'Create Device Detail'"
      :schema="editingId ? deviceDetailUpdateSchema : deviceDetailCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Device" name="deviceId" required>
        <USelect v-model="state.deviceId" :items="deviceOptions" class="w-full" />
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
