import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { createIntegrationTestProcesses } from './test-database-migration'

const require = createRequire(import.meta.url)
const vitestPackagePath = require.resolve('vitest/package.json')
const integrationTestProcesses = createIntegrationTestProcesses({
  environment: process.env,
  forwardedArguments: process.argv.slice(2),
  nodeExecutable: process.execPath,
  prismaCliPath: require.resolve('prisma/build/index.js'),
  vitestCliPath: resolve(dirname(vitestPackagePath), 'vitest.mjs'),
})

for (const processSpecification of integrationTestProcesses.processes) {
  const result = spawnSync(processSpecification.command, processSpecification.args, {
    env: processSpecification.environment,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
