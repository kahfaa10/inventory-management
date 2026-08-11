<script setup lang="ts">
withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })

const emit = defineEmits<{
  navigate: []
}>()

const { user, clear } = useUserSession()
const masterLinks = [
  { label: 'Models', to: '/master/models', icon: 'i-lucide-box' },
  { label: 'Service Tags', to: '/master/service-tags', icon: 'i-lucide-tag' },
  { label: 'Parts', to: '/master/devices', icon: 'i-lucide-hard-drive' },
  { label: 'Part Details', to: '/master/device-details', icon: 'i-lucide-cpu' },
  { label: 'Customers', to: '/master/customers', icon: 'i-lucide-building-2' },
  { label: 'Racks', to: '/master/racks', icon: 'i-lucide-warehouse' },
]
const transactionLinks = [
  {
    label: 'Stock Adjustment In',
    to: '/transactions/stock-adjustment-ins',
    icon: 'i-lucide-package-plus',
  },
  { label: 'Stock Releases', to: '/transactions/stock-releases', icon: 'i-lucide-package-minus' },
  { label: 'Stock Returns', to: '/transactions/stock-returns', icon: 'i-lucide-undo-2' },
]
const reportLinks = [
  { label: 'Stock Card', to: '/reports/stock-card', icon: 'i-lucide-clipboard-list' },
  {
    label: 'Stock Card by Customer',
    to: '/reports/stock-card-by-customer',
    icon: 'i-lucide-building-2',
  },
  { label: 'Stock-In', to: '/reports/stock-in', icon: 'i-lucide-file-input' },
  {
    label: 'Stock-In by Customer',
    to: '/reports/stock-in-by-customer',
    icon: 'i-lucide-building-2',
  },
  { label: 'Stock-Out', to: '/reports/stock-out', icon: 'i-lucide-file-output' },
  {
    label: 'Stock-Out by Customer',
    to: '/reports/stock-out-by-customer',
    icon: 'i-lucide-building-2',
  },
]

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  emit('navigate')
  await navigateTo('/login')
}
</script>

<template>
  <aside
    :class="
      mobile
        ? 'flex h-full w-full flex-col bg-default'
        : 'fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-default bg-default lg:flex lg:flex-col'
    "
  >
    <div class="border-b border-default px-5 py-5">
      <UButton
        to="/"
        label="Mini Inventory"
        color="neutral"
        variant="link"
        class="px-0 text-lg font-bold"
      />
      <p class="mt-1 text-xs text-muted">Stock and spare parts</p>
    </div>

    <nav class="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
      <p class="px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">Master</p>
      <UButton
        v-for="link in masterLinks"
        :key="link.to"
        :to="link.to"
        :icon="link.icon"
        :label="link.label"
        color="neutral"
        variant="ghost"
        block
        class="mb-1 justify-start"
        @click="emit('navigate')"
      />
      <p class="mt-4 px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Transaction
      </p>
      <UButton
        v-for="link in transactionLinks"
        :key="link.to"
        :to="link.to"
        :icon="link.icon"
        :label="link.label"
        color="neutral"
        variant="ghost"
        block
        class="mb-1 justify-start"
        @click="emit('navigate')"
      />
      <p class="mt-4 px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">Report</p>
      <UButton
        v-for="link in reportLinks"
        :key="link.to"
        :to="link.to"
        :icon="link.icon"
        :label="link.label"
        color="neutral"
        variant="ghost"
        block
        class="mb-1 justify-start"
        @click="emit('navigate')"
      />
    </nav>

    <div class="border-t border-default p-4">
      <p class="truncate text-sm font-medium">{{ user?.name }}</p>
      <p class="mb-3 truncate text-xs text-muted">{{ user?.role }}</p>
      <UButton
        label="Sign out"
        icon="i-lucide-log-out"
        color="neutral"
        variant="soft"
        block
        @click="logout"
      />
    </div>
  </aside>
</template>
