import { defineEventHandler, readBody, type H3Event } from 'h3'
import type { AppSessionUser } from '../../../shared/types/auth'
import { loginSchema } from '../../../shared/schemas/auth'
import { authenticateUser } from '../../services/auth.service'
import { ApiError } from '../../utils/api-error'

interface LoginRouteDependencies {
  readRequestBody?: (event: H3Event) => Promise<unknown>
  authenticate?: typeof authenticateUser
  setSession?: (
    event: H3Event,
    data: { user: AppSessionUser; loggedInAt: string },
  ) => Promise<unknown>
  now?: () => Date
}

export function createLoginHandler(dependencies: LoginRouteDependencies = {}) {
  return defineEventHandler(async (event) => {
    const readRequestBody = dependencies.readRequestBody ?? readBody
    const authenticate = dependencies.authenticate ?? authenticateUser
    const setSession =
      dependencies.setSession ?? ((currentEvent, data) => setUserSession(currentEvent, data))
    const now = dependencies.now ?? (() => new Date())
    const parsed = loginSchema.safeParse(await readRequestBody(event))

    if (!parsed.success) {
      throw ApiError.fromZodError(parsed.error)
    }

    const user = await authenticate(parsed.data)

    await setSession(event, {
      user,
      loggedInAt: now().toISOString(),
    })

    return { user }
  })
}

export default createLoginHandler()
