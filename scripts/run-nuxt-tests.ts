import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import {
  classifyNuxtVitestResult,
  createNuxtTestProcesses,
  getNuxtTestRunExitCode,
  type NuxtVitestProcessResult,
} from './nuxt-test-database'

const require = createRequire(import.meta.url)
const vitestPackagePath = require.resolve('vitest/package.json')
const forwardedArguments = process.argv.slice(2)
if (forwardedArguments[0] === '--') forwardedArguments.shift()
const nuxtTestProcesses = createNuxtTestProcesses({
  environment: process.env,
  forwardedArguments,
  nodeExecutable: process.execPath,
  prismaCliPath: require.resolve('prisma/build/index.js'),
  vitestCliPath: resolve(dirname(vitestPackagePath), 'vitest.mjs'),
})

const vitestResults: NuxtVitestProcessResult[] = []

for (const processSpecification of nuxtTestProcesses.processes) {
  const capturesOutput = processSpecification.kind === 'vitest'
  const result = spawnSync(processSpecification.command, processSpecification.args, {
    env: processSpecification.environment,
    encoding: capturesOutput ? 'utf8' : undefined,
    maxBuffer: capturesOutput ? 32 * 1024 * 1024 : undefined,
    stdio: capturesOutput ? 'pipe' : 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (processSpecification.kind === 'migration') {
    if (result.status !== 0) process.exit(result.status ?? 1)
    continue
  }

  const standardOutput = typeof result.stdout === 'string' ? result.stdout : ''
  const standardError = typeof result.stderr === 'string' ? result.stderr : ''
  process.stdout.write(standardOutput)
  process.stderr.write(standardError)

  const vitestResult = {
    output: `${standardOutput}\n${standardError}`,
    project: processSpecification.project,
    status: result.status,
  }
  vitestResults.push(vitestResult)
  const classification = classifyNuxtVitestResult(vitestResult)

  if (classification.kind === 'failed') {
    process.exit(classification.exitCode)
  }
}

const exitCode = getNuxtTestRunExitCode(vitestResults)
if (exitCode !== 0) {
  console.error('No tests matched either Nuxt test project.')
  process.exit(exitCode)
}
