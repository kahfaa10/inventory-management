<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

export interface MasterListRow {
  id: string
  isActive: boolean
}

const props = defineProps<{
  rows: MasterListRow[]
  columns: TableColumn<MasterListRow>[]
  loading?: boolean
  total: number
  pageSize: number
  canWrite: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [row: MasterListRow]
  toggle: [row: MasterListRow]
}>()

const search = defineModel<string>('search', { default: '' })
const activeFilter = defineModel<string>('activeFilter', { default: 'all' })
const page = defineModel<number>('page', { default: 1 })

const activeOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const tableColumns = computed<TableColumn<MasterListRow>[]>(() => [
  ...props.columns,
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (row.original.isActive ? 'Active' : 'Inactive'),
  },
  ...(props.canWrite ? [{ id: 'actions', header: 'Actions' }] : []),
])
</script>

<template>
  <UCard>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search"
        class="min-w-64 flex-1"
      />
      <USelect v-model="activeFilter" :items="activeOptions" class="w-40" />
      <slot name="filters" />
      <UButton v-if="canWrite" label="Create" icon="i-lucide-plus" @click="emit('create')" />
    </div>

    <UTable :data="rows" :columns="tableColumns" :loading="loading">
      <template #status-cell="{ row }">
        <UBadge :color="row.original.isActive ? 'success' : 'neutral'" variant="soft">
          {{ row.original.isActive ? 'Active' : 'Inactive' }}
        </UBadge>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex items-center gap-2">
          <UButton
            label="Edit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('edit', row.original)"
          />
          <USwitch
            :model-value="row.original.isActive"
            :aria-label="`Set ${row.original.isActive ? 'inactive' : 'active'}`"
            @update:model-value="emit('toggle', row.original)"
          />
        </div>
      </template>
      <template #empty>
        <div class="py-8 text-center text-sm text-muted">No records found.</div>
      </template>
    </UTable>

    <div v-if="total > pageSize" class="mt-4 flex justify-end">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>
  </UCard>
</template>
