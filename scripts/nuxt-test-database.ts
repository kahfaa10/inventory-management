import { existsSync } from 'node:fs'
import { assertSafeTestDatabaseUrl } from '../tests/helpers/database-url'

interface NuxtTestProcessOptions {
  environment: NodeJS.ProcessEnv
  forwardedArguments: string[]
  nodeExecutable: string
  prismaCliPath: string
  vitestCliPath: string
}

export interface NuxtVitestProcessResult {
  output: string
  project: string
  status: number | null
}

export type NuxtVitestResultClassification =
  { kind: 'passed' } | { kind: 'no-tests' } | { kind: 'failed'; exitCode: number }

const exactTestFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const noTestsOutputPatterns = [/\bNo test files found\b/i, /\bNo tests found\b/i]
const allTestsSkippedPattern = /^\s*Tests\s+\d+\s+skipped\s+\(\d+\)\s*$/m

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

export function classifyNuxtVitestResult({
  output,
  status,
}: NuxtVitestProcessResult): NuxtVitestResultClassification {
  if (
    noTestsOutputPatterns.some((pattern) => pattern.test(output)) ||
    allTestsSkippedPattern.test(output)
  ) {
    return { kind: 'no-tests' }
  }
  if (status === 0) return { kind: 'passed' }
  return { kind: 'failed', exitCode: status ?? 1 }
}

export function getNuxtTestRunExitCode(results: readonly NuxtVitestProcessResult[]): number {
  let matchedProject = false

  for (const result of results) {
    const classification = classifyNuxtVitestResult(result)
    if (classification.kind === 'failed') return classification.exitCode
    if (classification.kind === 'passed') matchedProject = true
  }

  return matchedProject ? 0 : 1
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
        kind: 'migration' as const,
        command: nodeExecutable,
        args: [prismaCliPath, 'migrate', 'deploy'],
        environment: {
          ...environment,
          DATABASE_URL: testDatabaseUrl,
        },
      },
      {
        kind: 'vitest' as const,
        project: 'nuxt',
        command: nodeExecutable,
        args: [vitestCliPath, 'run', '--project', 'nuxt', ...forwardedArguments],
        environment: {
          ...environment,
          VITEST: 'true',
        },
      },
      {
        kind: 'vitest' as const,
        project: 'nuxt-http',
        command: nodeExecutable,
        args: [vitestCliPath, 'run', '--project', 'nuxt-http', ...forwardedArguments],
        environment: {
          ...environment,
          VITEST: 'true',
        },
      },
    ],
  }
}
