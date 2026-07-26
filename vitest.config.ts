import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.{test,spec}.ts'],
          exclude: [
            'tests/nuxt/auth-routes.test.ts',
            'tests/nuxt/master-api.test.ts',
            'tests/nuxt/stock-balance-api.test.ts',
            'tests/nuxt/stock-adjustment-in-api.test.ts',
          ],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('./tests/fixtures/nuxt', import.meta.url)),
            },
          },
        },
      }),
      {
        test: {
          name: 'nuxt-http',
          include: [
            'tests/nuxt/auth-routes.test.ts',
            'tests/nuxt/master-api.test.ts',
            'tests/nuxt/stock-balance-api.test.ts',
            'tests/nuxt/stock-adjustment-in-api.test.ts',
          ],
          environment: 'node',
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.{test,spec}.ts'],
          environment: 'node',
          fileParallelism: false,
        },
      },
    ],
  },
})
