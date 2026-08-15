import { describe, expect, it } from 'vitest'
import {
  assertSafeTestDatabaseUrl,
  resolvePrismaConnectionString,
} from '../../server/utils/database-url'

describe('test database URL guard', () => {
  const developmentUrl =
    'postgresql://postgres:postgres@localhost:5432/mini_inventory?schema=public'

  it('rejects a missing TEST_DATABASE_URL', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined, developmentUrl)).toThrow(
      'TEST_DATABASE_URL is required',
    )
  })

  it('rejects TEST_DATABASE_URL when it equals DATABASE_URL', () => {
    expect(() => assertSafeTestDatabaseUrl(developmentUrl, developmentUrl)).toThrow(
      'must not equal DATABASE_URL',
    )
  })

  it('rejects a database name without the _test suffix', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres:postgres@localhost:5432/inventory_staging?schema=public',
        developmentUrl,
      ),
    ).toThrow('must target a database suffixed "_test"')
  })

  it('accepts a distinct database name suffixed _test', () => {
    expect(
      assertSafeTestDatabaseUrl(
        'postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public',
        developmentUrl,
      ),
    ).toBe('postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public')
  })

  it('uses DATABASE_URL during normal application runtime even when a test URL exists', () => {
    expect(
      resolvePrismaConnectionString({
        DATABASE_URL: developmentUrl,
        TEST_DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public',
      }),
    ).toBe(developmentUrl)
  })

  it('uses the guarded TEST_DATABASE_URL only when Vitest explicitly marks the process', () => {
    const testDatabaseUrl =
      'postgresql://postgres:postgres@localhost:5432/mini_inventory_test?schema=public'

    expect(
      resolvePrismaConnectionString({
        DATABASE_URL: developmentUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        VITEST: 'true',
      }),
    ).toBe(testDatabaseUrl)
  })

  it('refuses to use an unsafe database URL from a Vitest process', () => {
    expect(() =>
      resolvePrismaConnectionString({
        DATABASE_URL: developmentUrl,
        TEST_DATABASE_URL: developmentUrl,
        VITEST: 'true',
      }),
    ).toThrow('TEST_DATABASE_URL must not equal DATABASE_URL')
  })
})
