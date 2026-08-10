<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { LoginInput } from '#shared/schemas/auth'
import { loginSchema } from '#shared/schemas/auth'

definePageMeta({ layout: false })

const route = useRoute()
const { fetch } = useUserSession()
const credentials = reactive<LoginInput>({
  email: '',
  password: '',
})
const errorMessage = ref('')
const isSubmitting = ref(false)

useHead({ title: 'Sign in | Mini Inventory' })

function safeRedirectPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

async function submit(_event: FormSubmitEvent<LoginInput>) {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    await fetch()
    await navigateTo(safeRedirectPath(route.query.redirect))
  } catch {
    errorMessage.value = 'Invalid email or password.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold text-highlighted">Mini Inventory</h1>
          <p class="mt-1 text-sm text-muted">Sign in with your internal account.</p>
        </div>
      </template>

      <UForm :schema="loginSchema" :state="credentials" class="space-y-4" @submit="submit">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          title="Sign in failed"
          :description="errorMessage"
        />

        <UFormField label="Email" name="email" required>
          <UInput
            v-model="credentials.email"
            type="email"
            autocomplete="username"
            placeholder="you@company.com"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput
            v-model="credentials.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>

        <UButton type="submit" block :loading="isSubmitting">Sign in</UButton>
      </UForm>
    </UCard>
  </main>
</template>
