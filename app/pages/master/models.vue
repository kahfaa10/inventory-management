<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { modelCreateSchema, modelUpdateSchema } from '#shared/schemas/masters'
import type { ModelDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<ModelDto>('/api/models')
const modalOpen = ref(false)
const editingId = ref<string>()
const state = reactive({
  modelName: '',
  description: '',
  isActive: true,
})
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'modelName', header: 'Model Name' },
  { accessorKey: 'description', header: 'Description' },
]

useHead({ title: 'Models | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  Object.assign(state, { modelName: '', description: '', isActive: true })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as ModelDto
  editingId.value = row.id
  Object.assign(state, {
    modelName: row.modelName,
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
    <PageHeader title="Models" description="Manage supported equipment models." />
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
      @toggle="resource.toggle($event as ModelDto)"
    />

    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Model' : 'Create Model'"
      :schema="editingId ? modelUpdateSchema : modelCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Model Name" name="modelName" required>
        <UInput v-model="state.modelName" class="w-full" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive">
        <USwitch v-model="state.isActive" />
      </UFormField>
    </MastersMasterFormModal>
  </section>
</template>
