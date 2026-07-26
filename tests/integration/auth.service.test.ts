import { hash } from 'argon2'
import { afterAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import { authenticateUser } from '../../server/services/auth.service'
import { prisma, withCleanDatabase } from '../helpers/database'

const TEST_PASSWORD = 'Correct-Horse-123!'

async function createUser(
  overrides: Partial<{
    email: string
    displayName: string
    password: string
    role: UserRole
    isActive: boolean
  }> = {},
) {
  const email = overrides.email ?? 'engineer@example.com'

  return prisma.user.create({
    data: {
      email,
      displayName: overrides.displayName ?? 'Inventory Engineer',
      passwordHash: await hash(overrides.password ?? TEST_PASSWORD),
      role: overrides.role ?? UserRole.USER,
      isActive: overrides.isActive ?? true,
    },
  })
}

describe('authenticateUser', () => {
  it('authenticates an active user without exposing the password hash', async () => {
    await withCleanDatabase(async () => {
      const user = await createUser()

      const result = await authenticateUser({
        email: `  ${user.email.toUpperCase()} `,
        password: TEST_PASSWORD,
      })

      expect(result).toEqual({
        id: user.id.toString(),
        email: user.email,
        name: user.displayName,
        role: 'USER',
      })
      expect(result).not.toHaveProperty('passwordHash')
    })
  })

  it.each([
    ['unknown email', { email: 'missing@example.com', password: TEST_PASSWORD }],
    ['incorrect password', { email: 'engineer@example.com', password: 'Definitely-Wrong-123!' }],
  ])('returns the generic unauthorized error for %s', async (_caseName, credentials) => {
    await withCleanDatabase(async () => {
      await createUser()

      await expect(authenticateUser(credentials)).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    })
  })

  it('rejects an inactive user with the same generic unauthorized error', async () => {
    await withCleanDatabase(async () => {
      const user = await createUser({ isActive: false })

      await expect(
        authenticateUser({ email: user.email, password: TEST_PASSWORD }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
