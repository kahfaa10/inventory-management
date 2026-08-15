<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TransactionStatus } from '#shared/enums/inventory'
import type { StockAdjustmentInDto } from '#shared/types/transactions'

const resource = useTransactionResource<StockAdjustmentInDto>('/api/stock-adjustment-ins')
const columns: TableColumn<{ id: string; status: TransactionStatus }>[] = [
  { accessorKey: 'transactionNumber', header: 'Transaction Number' },
  { accessorKey: 'transactionDate', header: 'Transaction Date' },
  { accessorKey: 'customer.customerName', header: 'Customer' },
  { accessorKey: 'createdBy.displayName', header: 'Created By' },
]
useHead({ title: 'Stock Adjustment In | Mini Inventory' })
</script>

<template>
  <section>
    <PageHeader title="Stock Adjustment In" description="Record stock entering inventory." />
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
      create-to="/transactions/stock-adjustment-ins/new"
      create-label="New Adjustment"
    >
      <template #actions="{ row }">
        <UButton :to="`/transactions/stock-adjustment-ins/${row.id}`" label="View" />
      </template>
    </TransactionsTransactionList>
  </section>
</template>
