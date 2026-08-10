<script setup lang="ts">
defineProps<{
  href: string
  enabled: boolean
}>()
</script>

<template>
  <UButton
    :href="enabled ? href : undefined"
    :disabled="!enabled"
    label="Export Excel"
    icon="i-lucide-file-spreadsheet"
    color="success"
    download
  />
</template>
