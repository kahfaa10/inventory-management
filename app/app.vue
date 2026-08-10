<script setup lang="ts">
const colorMode = useColorMode()

colorMode.preference = 'light'
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
