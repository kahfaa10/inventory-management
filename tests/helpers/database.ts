import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const connectionString = process.env.TEST_DATABASE_URL

if (!connectionString) {
  throw new Error('TEST_DATABASE_URL is required for integration tests.')
}

const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter })

async function cleanDatabase() {
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.stockReturnDetail.deleteMany(),
    prisma.stockReturn.deleteMany(),
    prisma.stockReleaseDetail.deleteMany(),
    prisma.stockRelease.deleteMany(),
    prisma.stockAdjustmentInDetail.deleteMany(),
    prisma.stockAdjustmentIn.deleteMany(),
    prisma.transactionCounter.deleteMany(),
    prisma.serviceTag.deleteMany(),
    prisma.deviceDetail.deleteMany(),
    prisma.rack.deleteMany(),
    prisma.device.deleteMany(),
    prisma.model.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

export async function withCleanDatabase<T>(callback: () => Promise<T>): Promise<T> {
  await cleanDatabase()

  try {
    return await callback()
  } finally {
    await cleanDatabase()
  }
}
