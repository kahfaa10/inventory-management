import { describe, expect, it } from 'vitest'
import { createIntegrationTestProcesses } from '../../scripts/test-database-migration'

describe('integration test processes', () => {
  const developmentUrl =
    'postgresql://postgres:postgres@localhost:5432/mini_inventory?schema=public'
  const testUrl = 'postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public'

  it('runs migration and tests with the validated test database environment', () => {
    expect(
      createIntegrationTestProcesses({
        environment: {
          DATABASE_URL: developmentUrl,
          TEST_DATABASE_URL: testUrl,
          PRESERVED_VALUE: 'preserved',
        },
        forwardedArguments: ['tests/integration/schema.test.ts'],
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
            'integration',
            'tests/integration/schema.test.ts',
          ],
          environment: {
            DATABASE_URL: developmentUrl,
            TEST_DATABASE_URL: testUrl,
            PRESERVED_VALUE: 'preserved',
          },
        },
      ],
    })
  })

  it('fails closed before constructing a command for an unsafe test database', () => {
    expect(() =>
      createIntegrationTestProcesses({
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
