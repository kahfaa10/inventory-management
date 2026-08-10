<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TransactionStatus } from '#shared/enums/inventory'
import type { StockReleaseDto } from '#shared/types/transactions'

const resource = useTransactionResource<StockReleaseDto>('/api/stock-releases')
const columns: TableColumn<{ id: string; status: TransactionStatus }>[] = [
  { accessorKey: 'transactionNumber', header: 'Transaction Number' },
  { accessorKey: 'releaseDate', header: 'Release Date' },
  { accessorKey: 'engineerName', header: 'Engineer' },
  { accessorKey: 'customer.customerName', header: 'Customer' },
]
useHead({ title: 'Stock Releases | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader title="Stock Releases" description="Release inventory parts to engineers." />
    <TransactionsTransactionList
      v-model:search="resource.search.value"
      v-model:status="resource.status.value"
      v-model:date-from="resource.dateFrom.value"
      v-model:date-to="resource.dateTo.value"
      v-model:page="resource.page.value"
      :rows="resource.rows.value"
      :columns="columns"
      :total="resource.total.value"
      :page-size="resource.pageSize"
      :loading="resource.pending.value"
      :error="resource.error.value?.message"
      create-to="/transactions/stock-releases/new"
      create-label="New Release"
    >
      <template #actions="{ row }">
        <UButton :to="`/transactions/stock-releases/${row.id}`" label="View" />
      </template>
    </TransactionsTransactionList>
  </section>
</template>
