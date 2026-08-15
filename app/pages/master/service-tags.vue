<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { serviceTagCreateSchema, serviceTagUpdateSchema } from '#shared/schemas/masters'
import type { CustomerDto, ModelDto, ServiceTagDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<ServiceTagDto>('/api/service-tags', ['modelId', 'customerId'])
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
const {
  data: models,
  pending: modelsPending,
  error: modelsError,
} = useActiveMasterOptions<ModelDto>('/api/models')
const {
  data: customers,
  pending: customersPending,
  error: customersError,
} = useActiveMasterOptions<CustomerDto>('/api/customers')
const modelOptions = computed(() => {
  const options = (models.value ?? []).map((item) => ({
    label: item.modelName,
    value: item.id,
  }))
  const current = selectedRecord.value?.model
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({
      label: current.isActive ? current.modelName : `${current.modelName} (Inactive)`,
      value: current.id,
    })
  }
  return options
})
const customerOptions = computed(() => {
  const options: { label: string; value: string | null }[] = [
    { label: 'No customer', value: null },
    ...(customers.value ?? []).map((item) => ({
      label: item.customerName,
      value: item.id,
    })),
  ]
  const current = selectedRecord.value?.customer
  if (current && !options.some((item) => item.value === current.id)) {
    options.push({
      label: current.isActive ? current.customerName : `${current.customerName} (Inactive)`,
      value: current.id,
    })
  }
  return options
})
const modelFilterOptions = computed(() => [
  ...(models.value ?? []).map((item) => ({ label: item.modelName, value: item.id })),
])
const customerFilterOptions = computed(() => [
  ...(customers.value ?? []).map((item) => ({ label: item.customerName, value: item.id })),
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
    <UAlert
      v-if="modelsError || customersError"
      class="mb-4"
      color="error"
      variant="soft"
      title="Unable to load active Model or Customer options"
      description="Refresh the page before creating or editing a Service Tag."
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
          placeholder="All models"
          aria-label="Filter by model"
          class="w-44"
          :loading="modelsPending"
          :disabled="modelsPending || !!modelsError"
        />
        <USelect
          v-model="resource.filters.customerId"
          :items="customerFilterOptions"
          placeholder="All customers"
          aria-label="Filter by customer"
          class="w-44"
          :loading="customersPending"
          :disabled="customersPending || !!customersError"
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
        <USelect
          v-model="state.modelId"
          :items="modelOptions"
          class="w-full"
          :loading="modelsPending"
          :disabled="modelsPending || !!modelsError"
        />
      </UFormField>
      <UFormField label="Customer" name="customerId">
        <USelect
          v-model="state.customerId"
          :items="customerOptions"
          class="w-full"
          :loading="customersPending"
          :disabled="customersPending || !!customersError"
        />
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
