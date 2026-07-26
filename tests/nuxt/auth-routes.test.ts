import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../server/utils/api-error'

const mocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  clearUserSession: vi.fn(),
  getUserSession: vi.fn(),
  readBody: vi.fn(),
  setUserSession: vi.fn(),
  userFindUnique: vi.fn(),
}))

vi.mock('../../server/services/auth.service', () => ({
  authenticateUser: mocks.authenticateUser,
}))

vi.mock('../../server/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}))

const event = {} as H3Event

describe('authentication routes and guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a sealed cookie session after successful login', async () => {
    const user = {
      id: '42',
      email: 'engineer@example.com',
      name: 'Inventory Engineer',
      role: 'USER' as const,
    }
    mocks.readBody.mockResolvedValue({
      email: ' ENGINEER@EXAMPLE.COM ',
      password: 'Correct-Horse-123!',
    })
    mocks.authenticateUser.mockResolvedValue(user)
    mocks.setUserSession.mockResolvedValue({ user })
    const { createLoginHandler } = await import('../../server/api/auth/login.post')
    const login = createLoginHandler({
      readRequestBody: mocks.readBody,
      authenticate: mocks.authenticateUser,
      setSession: mocks.setUserSession,
      now: () => new Date('2026-07-19T08:30:00.000Z'),
    })

    await expect(login(event)).resolves.toEqual({ user })
    expect(mocks.setUserSession).toHaveBeenCalledWith(event, {
      user,
      loggedInAt: '2026-07-19T08:30:00.000Z',
    })
    expect(mocks.setUserSession.mock.calls[0]?.[1]).not.toHaveProperty('passwordHash')
  })

  it('returns the same safe error for invalid login', async () => {
    mocks.readBody.mockResolvedValue({
      email: 'missing@example.com',
      password: 'Incorrect-Password-123!',
    })
    mocks.authenticateUser.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'),
    )
    const { createLoginHandler } = await import('../../server/api/auth/login.post')
    const login = createLoginHandler({
      readRequestBody: mocks.readBody,
      authenticate: mocks.authenticateUser,
      setSession: mocks.setUserSession,
    })

    await expect(login(event)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    })
  })

  it('rejects malformed or mass-assigned login bodies before authentication', async () => {
    mocks.readBody.mockResolvedValue({
      email: 'not-an-email',
      password: '',
      role: 'ADMIN',
    })
    const { createLoginHandler } = await import('../../server/api/auth/login.post')
    const login = createLoginHandler({
      readRequestBody: mocks.readBody,
      authenticate: mocks.authenticateUser,
      setSession: mocks.setUserSession,
    })

    await expect(login(event)).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      fieldErrors: {
        email: ['Enter a valid email address.'],
        password: ['Password is required.'],
        _form: ['Unrecognized key: "role"'],
      },
    })
    expect(mocks.authenticateUser).not.toHaveBeenCalled()
    expect(mocks.setUserSession).not.toHaveBeenCalled()
  })

  it('clears the sealed cookie session on logout', async () => {
    mocks.clearUserSession.mockResolvedValue(true)
    const { createLogoutHandler } = await import('../../server/api/auth/logout.post')
    const logout = createLogoutHandler({ clearSession: mocks.clearUserSession })

    await expect(logout(event)).resolves.toEqual({ success: true })
    expect(mocks.clearUserSession).toHaveBeenCalledWith(event)
  })

  it('rejects an anonymous request', async () => {
    mocks.getUserSession.mockResolvedValue({})
    const { requireAppUser } = await import('../../server/utils/auth')

    await expect(
      requireAppUser(event, {
        getSession: mocks.getUserSession,
        clearSession: mocks.clearUserSession,
        findUserById: mocks.userFindUnique,
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    })
  })

  it('rejects a User session from an Administrator-only action', async () => {
    mocks.getUserSession.mockResolvedValue({
      user: { id: '7', email: 'user@example.com', name: 'User', role: 'USER' },
    })
    mocks.userFindUnique.mockResolvedValue({
      id: 7n,
      email: 'user@example.com',
      displayName: 'User',
      role: 'USER',
      isActive: true,
    })
    const { requireRole } = await import('../../server/utils/auth')

    await expect(
      requireRole(event, ['ADMIN'], {
        getSession: mocks.getUserSession,
        clearSession: mocks.clearUserSession,
        findUserById: mocks.userFindUnique,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  })

  it('authorizes an active Administrator from the database, not stale cookie data', async () => {
    mocks.getUserSession.mockResolvedValue({
      user: { id: '8', email: 'old@example.com', name: 'Old Name', role: 'USER' },
    })
    mocks.userFindUnique.mockResolvedValue({
      id: 8n,
      email: 'admin@example.com',
      displayName: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    })
    const { requireRole } = await import('../../server/utils/auth')

    await expect(
      requireRole(event, ['ADMIN'], {
        getSession: mocks.getUserSession,
        clearSession: mocks.clearUserSession,
        findUserById: mocks.userFindUnique,
      }),
    ).resolves.toEqual({
      id: '8',
      email: 'admin@example.com',
      name: 'Administrator',
      role: 'ADMIN',
    })
  })

  it('rejects a sealed session after its user is deactivated', async () => {
    mocks.getUserSession.mockResolvedValue({
      user: { id: '9', email: 'former@example.com', name: 'Former User', role: 'USER' },
    })
    mocks.userFindUnique.mockResolvedValue({
      id: 9n,
      email: 'former@example.com',
      displayName: 'Former User',
      role: 'USER',
      isActive: false,
    })
    const { requireAppUser } = await import('../../server/utils/auth')

    await expect(
      requireAppUser(event, {
        getSession: mocks.getUserSession,
        clearSession: mocks.clearUserSession,
        findUserById: mocks.userFindUnique,
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    })
  })
})
