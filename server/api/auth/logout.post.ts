import { defineEventHandler, type H3Event } from 'h3'

interface LogoutRouteDependencies {
  clearSession?: (event: H3Event) => Promise<unknown>
}

export function createLogoutHandler(dependencies: LogoutRouteDependencies = {}) {
  return defineEventHandler(async (event) => {
    const clearSession =
      dependencies.clearSession ?? ((currentEvent) => clearUserSession(currentEvent))
    await clearSession(event)

    return { success: true }
  })
}

export default createLogoutHandler()
