<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { rackCreateSchema, rackUpdateSchema } from '#shared/schemas/masters'
import type { RackDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<RackDto>('/api/racks')
const modalOpen = ref(false)
const editingId = ref<string>()
const state = reactive({ rackCode: '', rackName: '', description: '', isActive: true })
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'rackCode', header: 'Rack Code' },
  { accessorKey: 'rackName', header: 'Rack Name' },
  { accessorKey: 'description', header: 'Description' },
]

useHead({ title: 'Racks | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  Object.assign(state, { rackCode: '', rackName: '', description: '', isActive: true })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as RackDto
  editingId.value = row.id
  Object.assign(state, {
    rackCode: row.rackCode,
    rackName: row.rackName,
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
    <PageHeader title="Racks" description="Manage physical stock storage locations." />
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
      @toggle="resource.toggle($event as RackDto)"
    />
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Rack' : 'Create Rack'"
      :schema="editingId ? rackUpdateSchema : rackCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Rack Code" name="rackCode" required>
          <UInput v-model="state.rackCode" class="w-full" />
        </UFormField>
        <UFormField label="Rack Name" name="rackName" required>
          <UInput v-model="state.rackName" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive"><USwitch v-model="state.isActive" /></UFormField>
    </MastersMasterFormModal>
  </section>
</template>
