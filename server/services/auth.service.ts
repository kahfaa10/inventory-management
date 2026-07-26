import { verify } from 'argon2'
import type { LoginInput } from '../../shared/schemas/auth'
import type { AppSessionUser } from '../../shared/types/auth'
import { ApiError } from '../utils/api-error'
import { prisma } from '../utils/prisma'

const invalidCredentialsError = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')

export async function authenticateUser(credentials: LoginInput): Promise<AppSessionUser> {
  const email = credentials.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user?.isActive) {
    throw invalidCredentialsError()
  }

  let passwordMatches: boolean

  try {
    passwordMatches = await verify(user.passwordHash, credentials.password)
  } catch {
    passwordMatches = false
  }

  if (!passwordMatches) {
    throw invalidCredentialsError()
  }

  return {
    id: user.id.toString(),
    email: user.email,
    name: user.displayName,
    role: user.role,
  }
}
