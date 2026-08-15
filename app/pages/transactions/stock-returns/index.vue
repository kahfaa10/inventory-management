<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TransactionStatus } from '#shared/enums/inventory'
import type { StockReturnDto } from '#shared/types/transactions'

const resource = useTransactionResource<StockReturnDto>('/api/stock-returns')
const columns: TableColumn<{ id: string; status: TransactionStatus }>[] = [
  { accessorKey: 'transactionNumber', header: 'Transaction Number' },
  { accessorKey: 'returnDate', header: 'Return Date' },
  { accessorKey: 'stockRelease.transactionNumber', header: 'Original Release' },
  { accessorKey: 'customer.customerName', header: 'Customer' },
]
useHead({ title: 'Stock Returns | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader title="Stock Returns" description="Return previously released inventory." />
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
      create-to="/transactions/stock-returns/new"
      create-label="New Return"
    >
      <template #actions="{ row }">
        <UButton :to="`/transactions/stock-returns/${row.id}`" label="View" />
      </template>
    </TransactionsTransactionList>
  </section>
</template>
