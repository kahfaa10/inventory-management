<script setup lang="ts" generic="TRow extends object">
import type { TableColumn } from '@nuxt/ui'

withDefaults(
  defineProps<{
    rows: TRow[]
    columns: TableColumn<TRow>[]
    total: number
    pageSize: number
    loading?: boolean
    error?: string
    ready?: boolean
    emptyMessage?: string
  }>(),
  { ready: true, error: '', emptyMessage: '' },
)
const page = defineModel<number>('page', { default: 1 })
</script>

<template>
  <UCard>
    <UAlert
      v-if="ready === false"
      color="info"
      variant="soft"
      title="Select a Customer"
      description="Customer is required before this report can be loaded or exported."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Report could not be loaded"
      :description="error"
    />
    <p v-else-if="loading" role="status" class="py-8 text-center text-sm text-muted">
      Loading report…
    </p>
    <div v-else class="overflow-x-auto">
      <UTable :data="rows" :columns="columns" class="min-w-max">
        <template #empty>
          <div class="py-8 text-center text-sm text-muted">
            {{ emptyMessage || 'No report records match the selected filters.' }}
          </div>
        </template>
      </UTable>
    </div>
    <div v-if="ready !== false && !error && total > pageSize" class="mt-4 flex justify-end">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>
  </UCard>
</template>
