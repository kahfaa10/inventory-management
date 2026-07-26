interface AdminSeedEnvironment {
  ADMIN_EMAIL?: string
  ADMIN_NAME?: string
  ADMIN_PASSWORD?: string
}

export interface AdminSeedConfig {
  email: string
  displayName: string
  password: string
}

export function resolveAdminSeedConfig(environment: AdminSeedEnvironment): AdminSeedConfig | null {
  const email = environment.ADMIN_EMAIL?.trim().toLowerCase()
  const displayName = environment.ADMIN_NAME?.trim()
  const password = environment.ADMIN_PASSWORD

  if (!email && !displayName && !password) {
    return null
  }

  if (!email || !displayName || !password) {
    throw new Error(
      'ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD must all be set to seed an administrator.',
    )
  }

  return { email, displayName, password }
}
