import type { H3Event } from 'h3'
import type { AppSessionUser, AppUserRole } from '../../shared/types/auth'
import { ApiError } from './api-error'
import { prisma } from './prisma'

interface StoredAppUser {
  id: bigint
  email: string
  displayName: string
  role: AppUserRole
  isActive: boolean
}

interface AuthGuardDependencies {
  getSession?: (event: H3Event) => Promise<{ user?: { id?: string } }>
  clearSession?: (event: H3Event) => Promise<unknown>
  findUserById?: (id: bigint) => Promise<StoredAppUser | null>
}

interface AppSessionReference {
  user?: {
    id?: string
  }
}

const unauthenticatedError = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.')

export async function refreshAppUser(
  event: H3Event,
  session: AppSessionReference,
  dependencies: AuthGuardDependencies = {},
): Promise<AppSessionUser> {
  const clearSession =
    dependencies.clearSession ?? ((currentEvent) => clearUserSession(currentEvent))
  const findUserById =
    dependencies.findUserById ??
    ((id) =>
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
        },
      }))

  if (!session.user?.id) {
    throw unauthenticatedError()
  }

  let userId: bigint

  try {
    userId = BigInt(session.user.id)
  } catch {
    await clearSession(event)
    throw unauthenticatedError()
  }

  const user = await findUserById(userId)

  if (!user?.isActive) {
    await clearSession(event)
    throw unauthenticatedError()
  }

  return {
    id: user.id.toString(),
    email: user.email,
    name: user.displayName,
    role: user.role,
  }
}

export async function requireAppUser(
  event: H3Event,
  dependencies: AuthGuardDependencies = {},
): Promise<AppSessionUser> {
  const getSession = dependencies.getSession ?? ((currentEvent) => getUserSession(currentEvent))
  const session = await getSession(event)

  return refreshAppUser(event, session, dependencies)
}

export async function requireRole(
  event: H3Event,
  roles: readonly AppUserRole[],
  dependencies: AuthGuardDependencies = {},
): Promise<AppSessionUser> {
  const user = await requireAppUser(event, dependencies)

  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.')
  }

  return user
}
