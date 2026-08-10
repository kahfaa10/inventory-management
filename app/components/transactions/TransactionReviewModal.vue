<script setup lang="ts">
const props = defineProps<{
  action: 'complete' | 'cancel'
  transactionNumber?: string
  pending?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
const isComplete = computed(() => props.action === 'complete')
</script>

<template>
  <UModal v-model:open="open">
    <template #body>
      <div class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold">
            {{ isComplete ? 'Complete transaction?' : 'Cancel transaction?' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ transactionNumber || 'This draft' }}
            {{
              isComplete
                ? 'will post inventory movements and become immutable.'
                : 'will be cancelled. Completed stock movements will be reversed.'
            }}
          </p>
        </div>
        <UAlert v-if="error" color="error" title="Unable to continue" :description="error" />
        <div class="flex justify-end gap-2">
          <UButton label="Back" color="neutral" variant="soft" @click="open = false" />
          <UButton
            data-action="confirm"
            :label="isComplete ? 'Confirm completion' : 'Confirm cancellation'"
            :color="isComplete ? 'primary' : 'error'"
            :loading="pending"
            :disabled="pending"
            @click="emit('confirm')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
