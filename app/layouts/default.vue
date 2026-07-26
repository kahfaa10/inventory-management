<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
    <AppSidebar />
    <div class="min-h-screen lg:pl-64">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-default bg-default/90 px-4 backdrop-blur lg:px-8"
      >
        <p class="font-semibold">Mini Inventory Management System</p>
        <span class="text-sm text-muted">Internal use</span>
      </header>
      <main class="p-4 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
