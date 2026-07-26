import { describe, expect, it, vi } from 'vitest'

describe('authentication verification work', () => {
  it('verifies a fixed dummy Argon2 hash when the account does not exist', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(false)
    const { createAuthenticateUser } = await import('../../server/services/auth.service')
    const authenticate = createAuthenticateUser({
      findUserByEmail: vi.fn().mockResolvedValue(null),
      verifyPassword,
    })

    await expect(
      authenticate({ email: 'missing@example.com', password: 'Attempted-Password-123!' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(verifyPassword).toHaveBeenCalledOnce()
    expect(verifyPassword.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/)
  })

  it('verifies the fixed dummy Argon2 hash for an inactive account too', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true)
    const { createAuthenticateUser } = await import('../../server/services/auth.service')
    const authenticate = createAuthenticateUser({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 1n,
        email: 'inactive@example.com',
        displayName: 'Inactive User',
        passwordHash: 'stored-inactive-hash',
        role: 'USER',
        isActive: false,
      }),
      verifyPassword,
    })

    await expect(
      authenticate({ email: 'inactive@example.com', password: 'Attempted-Password-123!' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(verifyPassword).toHaveBeenCalledOnce()
    expect(verifyPassword.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/)
    expect(verifyPassword.mock.calls[0]?.[0]).not.toBe('stored-inactive-hash')
  })
})
