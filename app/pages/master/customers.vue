<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { customerCreateSchema, customerUpdateSchema } from '#shared/schemas/masters'
import type { CustomerDto } from '#shared/types/masters'
import type { MasterListRow } from '../../components/masters/MasterList.vue'

const resource = useMasterResource<CustomerDto>('/api/customers')
const modalOpen = ref(false)
const editingId = ref<string>()
const state = reactive({
  customerName: '',
  address: '',
  contactPerson: '',
  contactNumber: '',
  description: '',
  isActive: true,
})
const columns: TableColumn<MasterListRow>[] = [
  { accessorKey: 'customerName', header: 'Customer Name' },
  { accessorKey: 'contactPerson', header: 'Contact Person' },
  { accessorKey: 'contactNumber', header: 'Contact Number' },
  { accessorKey: 'address', header: 'Address' },
]

useHead({ title: 'Customers | Mini Inventory' })

function createRecord() {
  editingId.value = undefined
  Object.assign(state, {
    customerName: '',
    address: '',
    contactPerson: '',
    contactNumber: '',
    description: '',
    isActive: true,
  })
  modalOpen.value = true
}

function editRecord(value: MasterListRow) {
  const row = value as CustomerDto
  editingId.value = row.id
  Object.assign(state, {
    customerName: row.customerName,
    address: row.address ?? '',
    contactPerson: row.contactPerson ?? '',
    contactNumber: row.contactNumber ?? '',
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
    <PageHeader title="Customers" description="Manage customers referenced by stock activity." />
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
      @toggle="resource.toggle($event as CustomerDto)"
    />
    <MastersMasterFormModal
      v-model:open="modalOpen"
      :title="editingId ? 'Edit Customer' : 'Create Customer'"
      :schema="editingId ? customerUpdateSchema : customerCreateSchema"
      :state="state"
      :submitting="resource.submitting.value"
      @submit="submit"
    >
      <UFormField label="Customer Name" name="customerName" required>
        <UInput v-model="state.customerName" class="w-full" />
      </UFormField>
      <UFormField label="Address" name="address">
        <UTextarea v-model="state.address" class="w-full" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Contact Person" name="contactPerson">
          <UInput v-model="state.contactPerson" class="w-full" />
        </UFormField>
        <UFormField label="Contact Number" name="contactNumber">
          <UInput v-model="state.contactNumber" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Description" name="description">
        <UTextarea v-model="state.description" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="isActive"><USwitch v-model="state.isActive" /></UFormField>
    </MastersMasterFormModal>
  </section>
</template>
