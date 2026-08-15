<script setup lang="ts">
import type { TransactionStatus } from '#shared/enums/inventory'

const props = defineProps<{ status: TransactionStatus }>()
const colors = { DRAFT: 'warning', COMPLETED: 'success', CANCELLED: 'error' } as const
</script>

<template>
  <UBadge :color="colors[props.status]" variant="soft">{{ props.status }}</UBadge>
</template>
