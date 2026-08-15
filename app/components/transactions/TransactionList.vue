<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TransactionStatus } from '#shared/enums/inventory'

interface TransactionRow {
  id: string
  status: TransactionStatus
}

const props = defineProps<{
  rows: TransactionRow[]
  columns: TableColumn<TransactionRow>[]
  total: number
  pageSize: number
  createTo: string
  createLabel: string
  loading?: boolean
  error?: string
}>()
const search = defineModel<string>('search', { default: '' })
const status = defineModel<string>('status', { default: 'all' })
const dateFrom = defineModel<string>('dateFrom', { default: '' })
const dateTo = defineModel<string>('dateTo', { default: '' })
const page = defineModel<number>('page', { default: 1 })
const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]
const tableColumns = computed<TableColumn<TransactionRow>[]>(() => [
  ...props.columns,
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' },
])
</script>

<template>
  <UCard>
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <UFormField label="Search" class="min-w-56 flex-1">
        <UInput v-model="search" placeholder="Search transactions" icon="i-lucide-search" />
      </UFormField>
      <UFormField label="Status">
        <USelect v-model="status" :items="statusOptions" aria-label="Transaction status" />
      </UFormField>
      <UFormField label="Date from">
        <UInput v-model="dateFrom" type="date" aria-label="Date from" />
      </UFormField>
      <UFormField label="Date to">
        <UInput v-model="dateTo" type="date" aria-label="Date to" />
      </UFormField>
      <slot name="filters" />
      <UButton :to="createTo" :label="createLabel" icon="i-lucide-plus" />
    </div>

    <UAlert
      v-if="error"
      color="error"
      title="Transactions could not be loaded"
      :description="error"
    />
    <p v-if="loading" role="status" class="py-6 text-center text-sm text-muted">
      Loading transactions…
    </p>
    <UTable v-else :data="rows" :columns="tableColumns">
      <template #status-cell="{ row }">
        <TransactionsTransactionStatusBadge :status="row.original.status" />
      </template>
      <template #actions-cell="{ row }">
        <slot name="actions" :row="row.original">
          <UButton :to="`${createTo.replace(/\/new$/, '')}/${row.original.id}`" label="View" />
        </slot>
      </template>
      <template #empty>
        <div class="py-8 text-center text-sm text-muted">No transactions found.</div>
      </template>
    </UTable>
    <div v-if="total > pageSize" class="mt-4 flex justify-end">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>
  </UCard>
</template>
