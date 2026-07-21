export default defineNuxtConfig({
  compatibilityDate: '2026-07-19',
  modules: ['@nuxt/ui', 'nuxt-auth-utils', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
    },
  },
})
