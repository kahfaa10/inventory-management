<script setup lang="ts">
import type { TransactionStatus } from '#shared/enums/inventory'

const props = defineProps<{
  status: TransactionStatus
  pending?: boolean
  completeDisabled?: boolean
}>()
const emit = defineEmits<{ edit: []; complete: []; cancel: [] }>()
const { user } = useUserSession()
const isDraft = computed(() => props.status === 'DRAFT')
const canCancel = computed(() => user.value?.role === 'ADMIN' && props.status !== 'CANCELLED')
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" aria-label="Transaction actions">
    <UButton
      v-if="isDraft"
      label="Edit"
      icon="i-lucide-pencil"
      color="neutral"
      variant="soft"
      :disabled="pending"
      @click="emit('edit')"
    />
    <UButton
      v-if="isDraft"
      label="Complete"
      icon="i-lucide-check"
      :disabled="pending || completeDisabled"
      :title="completeDisabled ? 'Save draft changes before completing.' : undefined"
      @click="emit('complete')"
    />
    <UButton
      v-if="canCancel"
      label="Cancel"
      icon="i-lucide-x"
      color="error"
      variant="soft"
      :disabled="pending"
      @click="emit('cancel')"
    />
  </div>
</template>
