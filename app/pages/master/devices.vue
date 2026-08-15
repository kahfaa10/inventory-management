<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { deviceCreateSchema, deviceUpdateSchema } from '#shared/schemas/masters'
import type { DeviceDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<DeviceDto>('/api/devices')
const modalOpen = ref(false)
const editingId = ref<string>()
const state = reactive({ deviceName: '', description: '', isActive: true })
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'deviceName', header: 'Part Name' },
  { accessorKey: 'description', header: 'Description' },
]

useHead({ title: 'Parts | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  Object.assign(state, { deviceName: '', description: '', isActive: true })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as DeviceDto
  editingId.value = row.id
  Object.assign(state, {
    deviceName: row.deviceName,
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
    <PageHeader title="Parts" description="Manage general spare-part categories." />
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
      @toggle="resource.toggle($event as DeviceDto)"
    />
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Part' : 'Create Part'"
      :schema="editingId ? deviceUpdateSchema : deviceCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Part Name" name="deviceName" required>
        <UInput v-model="state.deviceName" class="w-full" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive"><USwitch v-model="state.isActive" /></UFormField>
    </MastersMasterFormModal>
  </section>
</template>
