<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  title: string
  description?: string
  schema: object
  state: Record<string, unknown>
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [event: FormSubmitEvent<Record<string, unknown>>]
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <UForm
        :schema="props.schema"
        :state="props.state"
        class="space-y-4"
        @submit="emit('submit', $event)"
      >
        <slot />
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="soft"
            type="button"
            @click="open = false"
          />
          <UButton label="Save" type="submit" :loading="submitting" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
