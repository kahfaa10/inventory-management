import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-19',
  modules: ['nuxt-auth-utils'],
  alias: {
    '#shared': fileURLToPath(new URL('../../../shared', import.meta.url)),
  },
  components: {
    dirs: [fileURLToPath(new URL('../../../app/components', import.meta.url))],
  },
  imports: {
    dirs: [fileURLToPath(new URL('../../../app/composables', import.meta.url))],
  },
  nitro: {
    scanDirs: [fileURLToPath(new URL('../../../server', import.meta.url))],
  },
  runtimeConfig: {
    session: {
      password: 'test-only-session-password-at-least-32-characters',
    },
  },
})
