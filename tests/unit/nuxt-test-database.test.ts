import { describe, expect, it } from 'vitest'
import { createNuxtTestProcesses, getNuxtTestRunExitCode } from '../../scripts/nuxt-test-database'

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
          kind: 'migration',
          command: '/path/to/node',
          args: ['/path/to/prisma-cli.js', 'migrate', 'deploy'],
          environment: {
            DATABASE_URL: testUrl,
            TEST_DATABASE_URL: testUrl,
            PRESERVED_VALUE: 'preserved',
          },
        },
        {
          kind: 'vitest',
          project: 'nuxt',
          command: '/path/to/node',
          args: [
            '/path/to/vitest-cli.mjs',
            'run',
            '--project',
            'nuxt',
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
          kind: 'vitest',
          project: 'nuxt-http',
          command: '/path/to/node',
          args: [
            '/path/to/vitest-cli.mjs',
            'run',
            '--project',
            'nuxt-http',
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

  it('fails before migration when an exact targeted test path does not exist', () => {
    expect(() =>
      createNuxtTestProcesses({
        environment: {
          DATABASE_URL: developmentUrl,
          TEST_DATABASE_URL: testUrl,
        },
        forwardedArguments: ['tests/nuxt/definitely-mistyped.test.ts'],
        nodeExecutable: '/path/to/node',
        prismaCliPath: '/path/to/prisma-cli.js',
        vitestCliPath: '/path/to/vitest-cli.mjs',
      }),
    ).toThrow('Targeted test file does not exist: tests/nuxt/definitely-mistyped.test.ts')
  })

  const passed = (project: string) => ({ project, status: 0, output: '1 test passed' })
  const noTests = (project: string) => ({
    project,
    status: 1,
    output: 'No test files found, exiting with code 1',
  })
  const allTestsSkipped = (project: string) => ({
    project,
    status: 0,
    output: ' Test Files  1 skipped (1)\n      Tests  14 skipped (14)',
  })

  it('succeeds when component tests pass and HTTP has no matching tests', () => {
    expect(getNuxtTestRunExitCode([passed('nuxt'), noTests('nuxt-http')])).toBe(0)
  })

  it('succeeds when component has no matching tests and HTTP tests pass', () => {
    expect(getNuxtTestRunExitCode([noTests('nuxt'), passed('nuxt-http')])).toBe(0)
  })

  it('fails when neither Nuxt project matches tests', () => {
    expect(getNuxtTestRunExitCode([noTests('nuxt'), noTests('nuxt-http')])).toBe(1)
  })

  it('fails when a name filter skips every discovered test', () => {
    expect(getNuxtTestRunExitCode([allTestsSkipped('nuxt'), allTestsSkipped('nuxt-http')])).toBe(1)
  })

  it('fails on a real test failure even when another project passes', () => {
    expect(
      getNuxtTestRunExitCode([
        passed('nuxt'),
        {
          project: 'nuxt-http',
          status: 2,
          output: 'Tests 1 failed',
        },
      ]),
    ).toBe(2)
  })
})
