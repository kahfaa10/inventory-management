import { assertSafeTestDatabaseUrl } from '../tests/helpers/database-url'

interface IntegrationTestProcessOptions {
  environment: NodeJS.ProcessEnv
  forwardedArguments: string[]
  nodeExecutable: string
  prismaCliPath: string
  vitestCliPath: string
}

export function createIntegrationTestProcesses({
  environment,
  forwardedArguments,
  nodeExecutable,
  prismaCliPath,
  vitestCliPath,
}: IntegrationTestProcessOptions) {
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
        args: [vitestCliPath, 'run', '--project', 'integration', ...forwardedArguments],
        environment: {
          ...environment,
        },
      },
    ],
  }
}
