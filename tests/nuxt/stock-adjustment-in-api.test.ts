import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import { getStockBalance } from '../../server/services/stock.service'
import { prisma, withCleanDatabase } from '../helpers/database'

const TEST_PASSWORD = 'Correct-Horse-123!'
let passwordHash = ''

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

beforeAll(async () => {
  passwordHash = await hash(TEST_PASSWORD)
})

async function createFixture() {
  const admin = await prisma.user.create({
    data: {
      email: 'adjustment-admin-api@example.com',
      displayName: 'Adjustment Administrator',
      passwordHash,
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'adjustment-user-api@example.com',
      displayName: 'Adjustment User',
      passwordHash,
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({
    data: { customerName: 'Adjustment API Customer' },
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

  return { admin, user, customer, device, detail, rack }
}

async function login(email: string): Promise<string> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  })
  expect(response.status).toBe(200)
  return response.headers.get('set-cookie')!.split(';', 1)[0]!
}

function adjustmentBody(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    transactionDate: '2026-07-19',
    customerId: fixture.customer.id.toString(),
    notes: 'HTTP adjustment',
    details: [
      {
        deviceDetailId: fixture.detail.id.toString(),
        destinationRackId: fixture.rack.id.toString(),
        quantity: 10,
        notes: 'Initial stock',
      },
    ],
  }
}

async function request(
  path: string,
  options: { cookie?: string; method?: string; body?: Record<string, unknown> } = {},
) {
  return fetch(path, {
    method: options.method,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
}

describe('Stock Adjustment In API over Nitro HTTP', () => {
  it('allows authenticated Users to create, list, read, update, and idempotently complete', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture()
      const userCookie = await login(fixture.user.email)

      expect((await request('/api/stock-adjustment-ins')).status).toBe(401)

      const createResponse = await request('/api/stock-adjustment-ins', {
        cookie: userCookie,
        method: 'POST',
        body: adjustmentBody(fixture),
      })
      expect(createResponse.status).toBe(201)
      const created = await createResponse.json()
      expect(created).toMatchObject({
        transactionNumber: 'SAI-202607-0001',
        status: 'DRAFT',
        customerId: fixture.customer.id.toString(),
        details: [
          {
            deviceDetailId: fixture.detail.id.toString(),
            destinationRackId: fixture.rack.id.toString(),
            quantity: 10,
          },
        ],
      })

      const updateResponse = await request(`/api/stock-adjustment-ins/${created.id}`, {
        cookie: userCookie,
        method: 'PUT',
        body: { ...adjustmentBody(fixture), notes: 'Updated over HTTP' },
      })
      expect(updateResponse.status).toBe(200)
      await expect(updateResponse.json()).resolves.toMatchObject({ notes: 'Updated over HTTP' })

      const listResponse = await request('/api/stock-adjustment-ins?status=DRAFT&search=0001', {
        cookie: userCookie,
      })
      expect(listResponse.status).toBe(200)
      await expect(listResponse.json()).resolves.toMatchObject({
        total: 1,
        data: [{ id: created.id }],
      })

      const getResponse = await request(`/api/stock-adjustment-ins/${created.id}`, {
        cookie: userCookie,
      })
      expect(getResponse.status).toBe(200)
      await expect(getResponse.json()).resolves.toMatchObject({ id: created.id })

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const completeResponse = await request(`/api/stock-adjustment-ins/${created.id}/complete`, {
          cookie: userCookie,
          method: 'POST',
        })
        expect(completeResponse.status).toBe(200)
        await expect(completeResponse.json()).resolves.toMatchObject({ status: 'COMPLETED' })
      }

      await expect(getStockBalance(prisma, fixture.detail.id, fixture.rack.id)).resolves.toBe(10)
      await expect(
        prisma.stockMovement.count({ where: { transactionId: BigInt(created.id) } }),
      ).resolves.toBe(1)
    })
  })

  it('allows only Administrators to cancel and keeps repeated cancellation idempotent', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture()
      const userCookie = await login(fixture.user.email)
      const adminCookie = await login(fixture.admin.email)
      const created = await (
        await request('/api/stock-adjustment-ins', {
          cookie: userCookie,
          method: 'POST',
          body: adjustmentBody(fixture),
        })
      ).json()
      expect(
        (
          await request(`/api/stock-adjustment-ins/${created.id}/complete`, {
            cookie: userCookie,
            method: 'POST',
          })
        ).status,
      ).toBe(200)

      expect(
        (
          await request(`/api/stock-adjustment-ins/${created.id}/cancel`, {
            cookie: userCookie,
            method: 'POST',
          })
        ).status,
      ).toBe(403)

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request(`/api/stock-adjustment-ins/${created.id}/cancel`, {
          cookie: adminCookie,
          method: 'POST',
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ status: 'CANCELLED' })
      }
      await expect(getStockBalance(prisma, fixture.detail.id, fixture.rack.id)).resolves.toBe(0)
      await expect(
        prisma.stockMovement.count({ where: { transactionId: BigInt(created.id) } }),
      ).resolves.toBe(2)
    })
  })

  it('strictly validates body, query, IDs, quantities, and active masters', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture()
      const cookie = await login(fixture.user.email)
      const body = adjustmentBody(fixture)

      for (const invalidBody of [
        { ...body, status: 'COMPLETED' },
        { ...body, details: [{ ...body.details[0], quantity: 0 }] },
        { ...body, details: [] },
      ]) {
        const response = await request('/api/stock-adjustment-ins', {
          cookie,
          method: 'POST',
          body: invalidBody,
        })
        expect(response.status).toBe(422)
        await expect(response.json()).resolves.toMatchObject({
          data: { code: 'VALIDATION_ERROR' },
        })
      }

      expect((await request('/api/stock-adjustment-ins?unexpected=true', { cookie })).status).toBe(
        422,
      )
      expect((await request('/api/stock-adjustment-ins/not-a-number', { cookie })).status).toBe(422)

      await prisma.rack.update({ where: { id: fixture.rack.id }, data: { isActive: false } })
      const inactiveResponse = await request('/api/stock-adjustment-ins', {
        cookie,
        method: 'POST',
        body,
      })
      expect(inactiveResponse.status).toBe(422)
      await expect(inactiveResponse.json()).resolves.toMatchObject({
        data: { code: 'INACTIVE_MASTER' },
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
