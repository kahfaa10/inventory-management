import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import { prisma, withCleanDatabase } from '../helpers/database'

const TEST_PASSWORD = 'Correct-Horse-123!'

await setup({
  rootDir: fileURLToPath(new URL('../fixtures/nuxt', import.meta.url)),
  server: true,
  browser: false,
  env: {
    VITEST: 'true',
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  },
})

async function createUser({
  email,
  role = UserRole.USER,
  isActive = true,
}: {
  email: string
  role?: UserRole
  isActive?: boolean
}) {
  return prisma.user.create({
    data: {
      email,
      displayName: role === UserRole.ADMIN ? 'Inventory Administrator' : 'Inventory User',
      passwordHash: await hash(TEST_PASSWORD),
      role,
      isActive,
    },
  })
}

async function login(email: string, password = TEST_PASSWORD) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

function requestCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  expect(setCookie).toContain('nuxt-session=')
  return setCookie!.split(';', 1)[0]!
}

describe('sealed authentication sessions over Nitro HTTP', () => {
  it('logs in, sets a sealed cookie, and exposes only the safe session user', async () => {
    await withCleanDatabase(async () => {
      const user = await createUser({ email: 'engineer@example.com' })
      const loginResponse = await login(`  ${user.email.toUpperCase()} `)

      expect(loginResponse.status).toBe(200)
      const cookie = requestCookie(loginResponse)
      const loginBody = await loginResponse.json()
      expect(loginBody).toEqual({
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.displayName,
          role: 'USER',
        },
      })

      const sessionResponse = await fetch('/api/_auth/session', {
        headers: { cookie },
      })
      const session = await sessionResponse.json()

      expect(sessionResponse.status).toBe(200)
      expect(session.user).toEqual(loginBody.user)
      expect(session.loggedInAt).toEqual(expect.any(String))
      expect(JSON.stringify(session)).not.toContain('passwordHash')
    })
  })

  it.each([
    ['unknown user', 'missing@example.com', TEST_PASSWORD],
    ['wrong password', 'engineer@example.com', 'Definitely-Wrong-123!'],
    ['inactive user', 'inactive@example.com', TEST_PASSWORD],
  ])('returns the same generic login error for %s', async (_caseName, email, password) => {
    await withCleanDatabase(async () => {
      await createUser({ email: 'engineer@example.com' })
      await createUser({ email: 'inactive@example.com', isActive: false })

      const response = await login(email, password)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toMatchObject({
        statusCode: 401,
        data: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      })
    })
  })

  it('expires the cookie on logout and leaves an anonymous session', async () => {
    await withCleanDatabase(async () => {
      await createUser({ email: 'engineer@example.com' })
      const loginResponse = await login('engineer@example.com')
      const cookie = requestCookie(loginResponse)

      const logoutResponse = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { cookie },
      })
      const expiredCookie = logoutResponse.headers.get('set-cookie')

      expect(logoutResponse.status).toBe(200)
      expect(expiredCookie).toMatch(
        /^nuxt-session=; Path=\/; HttpOnly; Secure; SameSite=Lax(?:;|$)/i,
      )

      const sessionResponse = await fetch('/api/_auth/session', {
        headers: { cookie: expiredCookie!.split(';', 1)[0]! },
      })
      expect(sessionResponse.status).toBe(200)
      await expect(sessionResponse.json()).resolves.not.toHaveProperty('user')
    })
  })

  it('rejects an anonymous protected request', async () => {
    const response = await fetch('/api/test-auth/protected')
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toMatchObject({
      data: { code: 'UNAUTHENTICATED' },
    })
  })

  it('enforces Administrator authorization against the current database role', async () => {
    await withCleanDatabase(async () => {
      await createUser({ email: 'user@example.com' })
      await createUser({ email: 'admin@example.com', role: UserRole.ADMIN })

      const userCookie = requestCookie(await login('user@example.com'))
      const forbiddenResponse = await fetch('/api/test-auth/admin', {
        headers: { cookie: userCookie },
      })
      expect(forbiddenResponse.status).toBe(403)

      const adminCookie = requestCookie(await login('admin@example.com'))
      const allowedResponse = await fetch('/api/test-auth/admin', {
        headers: { cookie: adminCookie },
      })
      expect(allowedResponse.status).toBe(200)
      await expect(allowedResponse.json()).resolves.toMatchObject({
        user: { email: 'admin@example.com', role: 'ADMIN' },
      })
    })
  })

  it('rejects and clears a sealed session when its database user is deactivated', async () => {
    await withCleanDatabase(async () => {
      const user = await createUser({ email: 'former@example.com' })
      const cookie = requestCookie(await login(user.email))
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })

      const response = await fetch('/api/_auth/session', {
        headers: { cookie },
      })

      expect(response.status).toBe(401)
      const clearedCookie = response.headers.get('set-cookie')
      expect(clearedCookie).toMatch(
        /^nuxt-session=; Path=\/; HttpOnly; Secure; SameSite=Lax(?:;|$)/i,
      )
      await expect(response.json()).resolves.toMatchObject({
        data: { code: 'UNAUTHENTICATED' },
      })

      const anonymousSessionResponse = await fetch('/api/_auth/session', {
        headers: { cookie: clearedCookie!.split(';', 1)[0]! },
      })
      await expect(anonymousSessionResponse.json()).resolves.not.toHaveProperty('user')
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
