import { assertSafeTestDatabaseUrl } from '../tests/helpers/database-url'

interface NuxtTestProcessOptions {
  environment: NodeJS.ProcessEnv
  forwardedArguments: string[]
  nodeExecutable: string
  prismaCliPath: string
  vitestCliPath: string
}

export function createNuxtTestProcesses({
  environment,
  forwardedArguments,
  nodeExecutable,
  prismaCliPath,
  vitestCliPath,
}: NuxtTestProcessOptions) {
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
          '--project',
          'nuxt-http',
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
