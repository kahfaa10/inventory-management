import { describe, expect, it } from 'vitest'
import { resolveAdminSeedConfig } from '../../prisma/seed-config'

describe('administrator seed environment contract', () => {
  it('uses ADMIN_NAME and normalizes the administrator identity', () => {
    expect(
      resolveAdminSeedConfig({
        ADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ',
        ADMIN_NAME: ' Inventory Administrator ',
        ADMIN_PASSWORD: 'Seed-Password-123!',
      }),
    ).toEqual({
      email: 'admin@example.com',
      displayName: 'Inventory Administrator',
      password: 'Seed-Password-123!',
    })
  })

  it('rejects partial administrator configuration', () => {
    expect(() =>
      resolveAdminSeedConfig({
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_DISPLAY_NAME: 'Wrong variable',
        ADMIN_PASSWORD: 'Seed-Password-123!',
      }),
    ).toThrow('ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD must all be set')
  })
})
