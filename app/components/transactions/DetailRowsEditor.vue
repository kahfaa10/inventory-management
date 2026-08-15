<script setup lang="ts" generic="TRow extends { key: string }">
defineProps<{ rows: TRow[]; editable: boolean; emptyText?: string }>()
const emit = defineEmits<{ add: []; remove: [index: number] }>()
</script>

<template>
  <fieldset class="space-y-4">
    <legend class="mb-3 text-base font-semibold">Transaction details</legend>
    <UAlert
      v-if="rows.length === 0"
      color="neutral"
      title="No detail rows"
      :description="emptyText || 'Add at least one detail row.'"
    />
    <div v-for="(row, index) in rows" :key="row.key" class="rounded-lg border border-default p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-medium">Detail {{ index + 1 }}</h3>
        <UButton
          v-if="editable"
          :aria-label="`Remove detail row ${index + 1}`"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          @click="emit('remove', index)"
        />
      </div>
      <slot :row="row" :index="index" />
    </div>
    <UButton
      v-if="editable"
      aria-label="Add detail row"
      label="Add detail"
      icon="i-lucide-plus"
      color="neutral"
      variant="soft"
      @click="emit('add')"
    />
  </fieldset>
</template>
