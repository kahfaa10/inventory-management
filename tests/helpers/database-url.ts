function databaseTarget(connectionString: string, variableName: string) {
  let url: URL

  try {
    url = new URL(connectionString)
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`)
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`)
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

  return {
    databaseName,
    host: url.hostname.toLowerCase(),
    port: url.port || '5432',
  }
}

export function assertSafeTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
  developmentDatabaseUrl: string | undefined,
) {
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for integration tests.')
  }

  const testTarget = databaseTarget(testDatabaseUrl, 'TEST_DATABASE_URL')

  if (developmentDatabaseUrl) {
    const developmentTarget = databaseTarget(developmentDatabaseUrl, 'DATABASE_URL')

    if (
      testTarget.databaseName === developmentTarget.databaseName &&
      testTarget.host === developmentTarget.host &&
      testTarget.port === developmentTarget.port
    ) {
      throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.')
    }
  }

  if (!testTarget.databaseName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must target a database suffixed "_test".')
  }

  return testDatabaseUrl
}
