<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-highlighted">{{ title }}</h1>
      <p class="mt-1 text-sm text-muted">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
