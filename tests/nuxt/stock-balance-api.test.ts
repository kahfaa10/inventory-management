import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  MovementPurpose,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../../generated/prisma/client'
import { prisma, withCleanDatabase } from '../helpers/database'

const TEST_PASSWORD = 'Correct-Horse-123!'

await setup({
  rootDir: fileURLToPath(new URL('../fixtures/nuxt', import.meta.url)),
  server: true,
  browser: false,
  env: {
    VITEST: 'true',
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  },
})

async function createStock() {
  const user = await prisma.user.create({
    data: {
      email: 'balance@example.com',
      displayName: 'Balance User',
      passwordHash: await hash(TEST_PASSWORD),
      role: UserRole.USER,
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Hard Disk' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: '0B24496',
      specification: '600 GB SAS',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'A', rackName: 'Rack A' } })
  const adjustment = await prisma.stockAdjustmentIn.create({
    data: {
      transactionNumber: 'SAI-202607-0001',
      transactionDate: new Date('2026-07-19'),
      status: TransactionStatus.COMPLETED,
      createdById: user.id,
      details: {
        create: { deviceDetailId: detail.id, rackId: rack.id, quantity: 7 },
      },
    },
    include: { details: true },
  })
  await prisma.stockMovement.create({
    data: {
      deviceDetailId: detail.id,
      rackId: rack.id,
      transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
      transactionId: adjustment.id,
      transactionDetailId: adjustment.details[0]!.id,
      transactionNumber: adjustment.transactionNumber,
      transactionDate: adjustment.transactionDate,
      quantityIn: 7,
      quantityOut: 0,
      movementPurpose: MovementPurpose.ORIGINAL,
      createdById: user.id,
    },
  })

  return { user, detail, rack }
}

async function login(email: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  })
  expect(response.status).toBe(200)
  return response.headers.get('set-cookie')!.split(';', 1)[0]!
}

describe('stock balance API over Nitro HTTP', () => {
  it('requires authentication and returns the exact ledger balance as JSON-safe data', async () => {
    await withCleanDatabase(async () => {
      const { user, detail, rack } = await createStock()
      const path = `/api/stock/balance?deviceDetailId=${detail.id}&rackId=${rack.id}`

      expect((await fetch(path)).status).toBe(401)

      const response = await fetch(path, { headers: { cookie: await login(user.email) } })
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        deviceDetailId: detail.id.toString(),
        rackId: rack.id.toString(),
        balance: 7,
      })
    })
  })

  it.each([
    '/api/stock/balance',
    '/api/stock/balance?deviceDetailId=0&rackId=1',
    '/api/stock/balance?deviceDetailId=9223372036854775808&rackId=1',
    '/api/stock/balance?deviceDetailId=1&rackId=1&unexpected=true',
  ])('strictly rejects invalid or unbounded BIGINT queries: %s', async (path) => {
    await withCleanDatabase(async () => {
      const { user } = await createStock()
      const response = await fetch(path, { headers: { cookie: await login(user.email) } })

      expect(response.status).toBe(422)
      await expect(response.json()).resolves.toMatchObject({
        data: { code: 'VALIDATION_ERROR' },
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
