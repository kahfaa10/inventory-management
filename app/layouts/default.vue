<script setup lang="ts">
const mobileNavigationOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-950">
    <AppSidebar />
    <div class="min-h-screen lg:pl-64">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-default bg-default/90 px-4 backdrop-blur lg:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <UButton
            class="lg:hidden"
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            aria-label="Open navigation"
            :aria-expanded="mobileNavigationOpen"
            @click="mobileNavigationOpen = true"
          />
          <p class="truncate font-semibold">Mini Inventory Management System</p>
        </div>
        <span class="text-sm text-muted">Internal use</span>
      </header>
      <main class="p-4 lg:p-8">
        <slot />
      </main>
    </div>

    <USlideover
      v-model:open="mobileNavigationOpen"
      side="left"
      title="Navigation"
      description="Mini Inventory modules"
      :ui="{ content: 'w-full max-w-72', body: 'p-0 sm:p-0' }"
    >
      <template #body>
        <AppSidebar mobile @navigate="mobileNavigationOpen = false" />
      </template>
    </USlideover>
  </div>
</template>
