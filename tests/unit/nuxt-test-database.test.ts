import { describe, expect, it } from 'vitest'
import { createNuxtTestProcesses } from '../../scripts/nuxt-test-database'

describe('Nuxt test processes', () => {
  const developmentUrl =
    'postgresql://postgres:postgres@localhost:5432/mini_inventory?schema=public'
  const testUrl = 'postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public'

  it('migrates once then runs the component and HTTP projects sequentially', () => {
    expect(
      createNuxtTestProcesses({
        environment: {
          DATABASE_URL: developmentUrl,
          TEST_DATABASE_URL: testUrl,
          PRESERVED_VALUE: 'preserved',
        },
        forwardedArguments: ['tests/nuxt/auth-routes.test.ts'],
        nodeExecutable: '/path/to/node',
        prismaCliPath: '/path/to/prisma-cli.js',
        vitestCliPath: '/path/to/vitest-cli.mjs',
      }),
    ).toEqual({
      processes: [
        {
          command: '/path/to/node',
          args: ['/path/to/prisma-cli.js', 'migrate', 'deploy'],
          environment: {
            DATABASE_URL: testUrl,
            TEST_DATABASE_URL: testUrl,
            PRESERVED_VALUE: 'preserved',
          },
        },
        {
          command: '/path/to/node',
          args: [
            '/path/to/vitest-cli.mjs',
            'run',
            '--project',
            'nuxt',
            '--passWithNoTests',
            'tests/nuxt/auth-routes.test.ts',
          ],
          environment: {
            DATABASE_URL: developmentUrl,
            TEST_DATABASE_URL: testUrl,
            PRESERVED_VALUE: 'preserved',
            VITEST: 'true',
          },
        },
        {
          command: '/path/to/node',
          args: [
            '/path/to/vitest-cli.mjs',
            'run',
            '--project',
            'nuxt-http',
            '--passWithNoTests',
            'tests/nuxt/auth-routes.test.ts',
          ],
          environment: {
            DATABASE_URL: developmentUrl,
            TEST_DATABASE_URL: testUrl,
            PRESERVED_VALUE: 'preserved',
            VITEST: 'true',
          },
        },
      ],
    })
  })

  it('fails closed before constructing processes for an unsafe test database', () => {
    expect(() =>
      createNuxtTestProcesses({
        environment: {
          DATABASE_URL: developmentUrl,
          TEST_DATABASE_URL: developmentUrl,
        },
        forwardedArguments: [],
        nodeExecutable: '/path/to/node',
        prismaCliPath: '/path/to/prisma-cli.js',
        vitestCliPath: '/path/to/vitest-cli.mjs',
      }),
    ).toThrow('TEST_DATABASE_URL must not equal DATABASE_URL')
  })
})
