<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PaginatedResponse } from '#shared/types/api'
import { serviceTagCreateSchema, serviceTagUpdateSchema } from '#shared/schemas/masters'
import type { CustomerDto, ModelDto, ServiceTagDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<ServiceTagDto>('/api/service-tags')
const modalOpen = ref(false)
const editingId = ref<string>()
const selectedRecord = ref<ServiceTagDto>()
const state = reactive({
  modelId: '',
  customerId: null as string | null,
  serviceTag: '',
  description: '',
  isActive: true,
})
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'serviceTag', header: 'Service Tag' },
  { accessorKey: 'model.modelName', header: 'Model' },
  { accessorKey: 'customer.customerName', header: 'Customer' },
  { accessorKey: 'description', header: 'Description' },
]
const { data: models } = useFetch<PaginatedResponse<ModelDto>>('/api/models', {
  query: { isActive: true, pageSize: 100 },
})
const { data: customers } = useFetch<PaginatedResponse<CustomerDto>>('/api/customers', {
  query: { isActive: true, pageSize: 100 },
})
const modelOptions = computed(() => {
  const options = (models.value?.data ?? []).map((item) => ({
    label: item.modelName,
    value: item.id,
  }))
  const current = selectedRecord.value?.model
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({ label: `${current.modelName} (Inactive)`, value: current.id })
  }
  return options
})
const customerOptions = computed(() => {
  const options: { label: string; value: string | null }[] = [
    { label: 'No customer', value: null },
    ...(customers.value?.data ?? []).map((item) => ({
      label: item.customerName,
      value: item.id,
    })),
  ]
  const current = selectedRecord.value?.customer
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({ label: `${current.customerName} (Inactive)`, value: current.id })
  }
  return options
})
const modelFilterOptions = computed(() => [
  { label: 'All models', value: '' },
  ...modelOptions.value,
])
const customerFilterOptions = computed(() => [
  { label: 'All customers', value: '' },
  ...(customers.value?.data ?? []).map((item) => ({ label: item.customerName, value: item.id })),
])

useHead({ title: 'Service Tags | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  selectedRecord.value = undefined
  Object.assign(state, {
    modelId: '',
    customerId: null,
    serviceTag: '',
    description: '',
    isActive: true,
  })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as ServiceTagDto
  editingId.value = row.id
  selectedRecord.value = row
  Object.assign(state, {
    modelId: row.modelId,
    customerId: row.customerId,
    serviceTag: row.serviceTag,
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
      title="Service Tags"
      description="Manage customer service tags under their equipment model."
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
      @toggle="resource.toggle($event as ServiceTagDto)"
    >
      <template #filters>
        <USelect
          v-model="resource.filters.modelId"
          :items="modelFilterOptions"
          aria-label="Filter by model"
          class="w-44"
        />
        <USelect
          v-model="resource.filters.customerId"
          :items="customerFilterOptions"
          aria-label="Filter by customer"
          class="w-44"
        />
      </template>
    </MastersMasterList>
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Service Tag' : 'Create Service Tag'"
      :schema="editingId ? serviceTagUpdateSchema : serviceTagCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Model" name="modelId" required>
        <USelect v-model="state.modelId" :items="modelOptions" class="w-full" />
      </UFormField>
      <UFormField label="Customer" name="customerId">
        <USelect v-model="state.customerId" :items="customerOptions" class="w-full" />
      </UFormField>
      <UFormField label="Service Tag" name="serviceTag" required>
        <UInput v-model="state.serviceTag" class="w-full" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive"><USwitch v-model="state.isActive" /></UFormField>
    </MastersMasterFormModal>
  </section>
</template>
