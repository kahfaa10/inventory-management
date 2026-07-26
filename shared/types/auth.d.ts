export type AppUserRole = 'ADMIN' | 'USER'

export interface AppSessionUser {
  id: string
  email: string
  name: string
  role: AppUserRole
}

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: AppUserRole
  }

  interface UserSession {
    loggedInAt?: string
  }
}

export {}
