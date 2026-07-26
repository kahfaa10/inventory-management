import { describe, expect, it } from 'vitest'
import { assertSafeTestDatabaseUrl } from '../helpers/database-url'

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
})
