import 'dotenv/config'
import { hash } from 'argon2'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '../generated/prisma/client'
import { resolveAdminSeedConfig } from './seed-config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const administrator = resolveAdminSeedConfig(process.env)

  if (!administrator) {
    console.info(
      'Administrator seed skipped: ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD are not set.',
    )
    return
  }

  const passwordHash = await hash(administrator.password)

  await prisma.user.upsert({
    where: { email: administrator.email },
    create: {
      email: administrator.email,
      displayName: administrator.displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    update: {
      displayName: administrator.displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  console.info(`Administrator ${administrator.email} is ready.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
