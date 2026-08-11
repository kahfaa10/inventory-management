<script setup lang="ts">
export interface ReportFilterOption {
  label: string
  value: string
}

export interface ReportFilterDefinition {
  name: string
  label: string
  kind: 'date' | 'select' | 'text'
  placeholder?: string
  options?: ReportFilterOption[]
  required?: boolean
}

const props = defineProps<{
  modelValue: Record<string, string>
  definitions: ReportFilterDefinition[]
  loading?: boolean
  validationMessage?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

function update(name: string, value: string | undefined) {
  emit('update:modelValue', { ...props.modelValue, [name]: value ?? '' })
}

function selectItems(filter: ReportFilterDefinition) {
  return (filter.options ?? []).filter((option) => option.value !== '')
}

function selectPlaceholder(filter: ReportFilterDefinition) {
  return filter.options?.find((option) => option.value === '')?.label
}
</script>

<template>
  <UCard class="mb-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UFormField
        v-for="filter in definitions"
        :key="filter.name"
        :label="filter.label"
        :required="filter.required"
      >
        <USelect
          v-if="filter.kind === 'select'"
          :model-value="modelValue[filter.name] ?? ''"
          :items="selectItems(filter)"
          :placeholder="selectPlaceholder(filter)"
          :aria-label="filter.label"
          :loading="loading"
          :disabled="loading"
          class="w-full"
          @update:model-value="update(filter.name, $event)"
        />
        <UInput
          v-else
          :model-value="modelValue[filter.name] ?? ''"
          :type="filter.kind === 'date' ? 'date' : 'text'"
          :placeholder="filter.placeholder"
          :aria-label="filter.label"
          class="w-full"
          @update:model-value="update(filter.name, $event)"
        />
      </UFormField>
    </div>
    <p v-if="validationMessage" role="alert" class="mt-3 text-sm text-error">
      {{ validationMessage }}
    </p>
  </UCard>
</template>
