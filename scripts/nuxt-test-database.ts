import { existsSync } from 'node:fs'
import { assertSafeTestDatabaseUrl } from '../tests/helpers/database-url'

interface NuxtTestProcessOptions {
  environment: NodeJS.ProcessEnv
  forwardedArguments: string[]
  nodeExecutable: string
  prismaCliPath: string
  vitestCliPath: string
}

const exactTestFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/

function validateExactTargetedTestPaths(argumentsToForward: readonly string[]): void {
  for (const argument of argumentsToForward) {
    if (
      exactTestFilePattern.test(argument) &&
      !/[*?[\]{}]/.test(argument) &&
      !existsSync(argument)
    ) {
      throw new Error(`Targeted test file does not exist: ${argument}`)
    }
  }
}

export function createNuxtTestProcesses({
  environment,
  forwardedArguments,
  nodeExecutable,
  prismaCliPath,
  vitestCliPath,
}: NuxtTestProcessOptions) {
  validateExactTargetedTestPaths(forwardedArguments)
  const testDatabaseUrl = assertSafeTestDatabaseUrl(
    environment.TEST_DATABASE_URL,
    environment.DATABASE_URL,
  )

  return {
    processes: [
      {
        command: nodeExecutable,
        args: [prismaCliPath, 'migrate', 'deploy'],
        environment: {
          ...environment,
          DATABASE_URL: testDatabaseUrl,
        },
      },
      {
        command: nodeExecutable,
        args: [
          vitestCliPath,
          'run',
          '--project',
          'nuxt',
          '--passWithNoTests',
          ...forwardedArguments,
        ],
        environment: {
          ...environment,
          VITEST: 'true',
        },
      },
      {
        command: nodeExecutable,
        args: [
          vitestCliPath,
          'run',
          '--project',
          'nuxt-http',
          '--passWithNoTests',
          ...forwardedArguments,
        ],
        environment: {
          ...environment,
          VITEST: 'true',
        },
      },
    ],
  }
}
