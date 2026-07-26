import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-19',
  modules: ['nuxt-auth-utils'],
  nitro: {
    scanDirs: [fileURLToPath(new URL('../../../server', import.meta.url))],
  },
  runtimeConfig: {
    session: {
      password: 'test-only-session-password-at-least-32-characters',
    },
  },
})
