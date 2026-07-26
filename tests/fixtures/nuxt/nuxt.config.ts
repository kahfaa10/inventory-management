export default defineNuxtConfig({
  compatibilityDate: '2026-07-19',
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    session: {
      password: 'test-only-session-password-at-least-32-characters',
    },
  },
})
