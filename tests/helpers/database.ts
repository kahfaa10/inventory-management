import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { assertSafeTestDatabaseUrl } from './database-url'

const connectionString = assertSafeTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
)

const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter })

async function cleanDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "stock_movements",
      "stock_return_details",
      "stock_returns",
      "stock_release_details",
      "stock_releases",
      "stock_adjustment_in_details",
      "stock_adjustment_ins",
      "transaction_counters",
      "service_tags",
      "device_details",
      "racks",
      "devices",
      "models",
      "customers",
      "users"
    RESTART IDENTITY CASCADE
  `)
}

export async function withCleanDatabase<T>(callback: () => Promise<T>): Promise<T> {
  await cleanDatabase()

  try {
    return await callback()
  } finally {
    await cleanDatabase()
  }
}
