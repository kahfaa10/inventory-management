import 'dotenv/config'
import { hash } from 'argon2'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const displayName = process.env.ADMIN_NAME?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!email && !displayName && !password) {
    console.info(
      'Administrator seed skipped: ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD are not set.',
    )
    return
  }

  if (!email || !displayName || !password) {
    throw new Error(
      'ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD must all be set to seed an administrator.',
    )
  }

  const passwordHash = await hash(password)

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    update: {
      displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  console.info(`Administrator ${email} is ready.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
