import { verify } from 'argon2'
import type { LoginInput } from '../../shared/schemas/auth'
import type { AppSessionUser } from '../../shared/types/auth'
import { ApiError } from '../utils/api-error'
import { prisma } from '../utils/prisma'

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$MDEyMzQ1Njc4OWFiY2RlZg$Xc9PhArFg7kIpweqCSObH1imSR1que+R/O1qBAKEFlo'

interface AuthenticationUser {
  id: bigint
  email: string
  displayName: string
  passwordHash: string
  role: AppSessionUser['role']
  isActive: boolean
}

interface AuthenticationDependencies {
  findUserByEmail: (email: string) => Promise<AuthenticationUser | null>
  verifyPassword: (hash: string, password: string) => Promise<boolean>
}

const invalidCredentialsError = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')

export function createAuthenticateUser(dependencies: AuthenticationDependencies) {
  return async function authenticate(credentials: LoginInput): Promise<AppSessionUser> {
    const email = credentials.email.trim().toLowerCase()
    const user = await dependencies.findUserByEmail(email)
    const passwordHash = user?.isActive ? user.passwordHash : DUMMY_PASSWORD_HASH

    let passwordMatches: boolean

    try {
      passwordMatches = await dependencies.verifyPassword(passwordHash, credentials.password)
    } catch {
      passwordMatches = false
    }

    if (!user?.isActive || !passwordMatches) {
      throw invalidCredentialsError()
    }

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.displayName,
      role: user.role,
    }
  }
}

export const authenticateUser = createAuthenticateUser({
  findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),
  verifyPassword: verify,
})
