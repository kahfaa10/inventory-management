import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import {
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import {
  completeStockRelease,
  createStockRelease,
} from '../../server/services/stock-release.service'
import { getStockBalance } from '../../server/services/stock.service'
import { POSTGRES_SIGNED_INTEGER_MAX } from '../../shared/schemas/common'
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

async function fixture() {
  const admin = await prisma.user.create({
    data: {
      email: 'return-admin-api@example.com',
      displayName: 'Return API Admin',
      passwordHash,
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'return-user-api@example.com',
      displayName: 'Return API User',
      passwordHash,
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Return API Customer' } })
  const device = await prisma.device.create({ data: { deviceName: 'Return API Device' } })
  const detail = await prisma.deviceDetail.create({
    data: { deviceId: device.id, partNumber: 'RETURN-API', specification: 'Return API Part' },
  })
  const sourceRack = await prisma.rack.create({
    data: { rackCode: 'RETURN-API-A', rackName: 'Return API Rack A' },
  })
  const destinationRack = await prisma.rack.create({
    data: { rackCode: 'RETURN-API-B', rackName: 'Return API Rack B' },
  })
  const adjustment = await createStockAdjustmentIn(user.id, {
    transactionDate: '2026-07-18',
    details: [
      {
        deviceDetailId: detail.id.toString(),
        destinationRackId: sourceRack.id.toString(),
        quantity: 3,
      },
    ],
  })
  await completeStockAdjustmentIn(adjustment.id, user.id)
  const release = await completeStockRelease(
    (
      await createStockRelease(user.id, {
        releaseDate: '2026-07-19',
        engineerName: 'Return API Engineer',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: sourceRack.id.toString(),
            releasedQuantity: 3,
          },
        ],
      })
    ).id,
    user.id,
  )
  return {
    admin,
    user,
    customer,
    detail,
    sourceRack,
    destinationRack,
    release,
    releaseDetail: release.details[0]!,
  }
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

function returnBody(data: Awaited<ReturnType<typeof fixture>>, quantity = 1) {
  return {
    returnDate: '2026-07-20',
    stockReleaseId: data.release.id,
    notes: 'API Return',
    details: [
      {
        stockReleaseDetailId: data.releaseDetail.id,
        destinationRackId: data.destinationRack.id.toString(),
        returnQuantity: quantity,
        notes: 'API Return Line',
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

describe('Stock Return API over genuine Nitro HTTP', () => {
  it('allows authenticated Users through eligibility, draft CRUD, and idempotent completion', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const cookie = await login(data.user.email)

      expect((await request('/api/stock-returns')).status).toBe(401)
      const eligible = await request('/api/stock-returns/eligible-releases?search=API', { cookie })
      expect(eligible.status).toBe(200)
      await expect(eligible.json()).resolves.toMatchObject({
        total: 1,
        data: [{ id: data.release.id, details: [{ remainingReturnableQuantity: 3 }] }],
      })

      const createResponse = await request('/api/stock-returns', {
        cookie,
        method: 'POST',
        body: returnBody(data),
      })
      expect(createResponse.status).toBe(201)
      const created = await createResponse.json()
      expect(created).toMatchObject({
        transactionNumber: 'SRT-202607-0001',
        status: 'DRAFT',
        engineerName: 'Return API Engineer',
        details: [{ returnQuantity: 1, remainingReturnableQuantity: 3 }],
      })
      expect((await request(`/api/stock-returns/${created.id}`, { cookie })).status).toBe(200)
      await expect(
        (
          await request('/api/stock-returns?search=API&status=DRAFT', {
            cookie,
          })
        ).json(),
      ).resolves.toMatchObject({ total: 1, data: [{ id: created.id }] })

      const updateResponse = await request(`/api/stock-returns/${created.id}`, {
        cookie,
        method: 'PUT',
        body: returnBody(data, 2),
      })
      expect(updateResponse.status).toBe(200)
      await expect(updateResponse.json()).resolves.toMatchObject({
        details: [{ returnQuantity: 2 }],
      })

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const completeResponse = await request(`/api/stock-returns/${created.id}/complete`, {
          cookie,
          method: 'POST',
        })
        expect(completeResponse.status).toBe(200)
        await expect(completeResponse.json()).resolves.toMatchObject({
          status: 'COMPLETED',
          details: [{ remainingReturnableQuantity: 1 }],
        })
      }
      await expect(getStockBalance(prisma, data.detail.id, data.destinationRack.id)).resolves.toBe(
        2,
      )
    })
  })

  it('enforces Administrator-only cancellation and creates the reversal', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const userCookie = await login(data.user.email)
      const adminCookie = await login(data.admin.email)
      const created = await (
        await request('/api/stock-returns', {
          cookie: userCookie,
          method: 'POST',
          body: returnBody(data),
        })
      ).json()
      await request(`/api/stock-returns/${created.id}/complete`, {
        cookie: userCookie,
        method: 'POST',
      })

      expect(
        (
          await request(`/api/stock-returns/${created.id}/cancel`, {
            cookie: userCookie,
            method: 'POST',
          })
        ).status,
      ).toBe(403)
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request(`/api/stock-returns/${created.id}/cancel`, {
          cookie: adminCookie,
          method: 'POST',
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ status: 'CANCELLED' })
      }
      await expect(getStockBalance(prisma, data.detail.id, data.destinationRack.id)).resolves.toBe(
        0,
      )
    })
  })

  it('strictly validates request bodies, query fields, IDs, and quantity boundaries', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const cookie = await login(data.user.email)
      const body = returnBody(data)

      for (const invalidBody of [
        { ...body, status: 'COMPLETED' },
        { ...body, stockReleaseId: undefined },
        { ...body, details: [] },
        { ...body, details: [{ ...body.details[0], returnQuantity: 0 }] },
        {
          ...body,
          details: [
            {
              ...body.details[0],
              returnQuantity: POSTGRES_SIGNED_INTEGER_MAX + 1,
            },
          ],
        },
      ]) {
        const response = await request('/api/stock-returns', {
          cookie,
          method: 'POST',
          body: invalidBody,
        })
        expect(response.status).toBe(422)
        await expect(response.json()).resolves.toMatchObject({
          data: { code: 'VALIDATION_ERROR' },
        })
      }

      expect((await request('/api/stock-returns?unexpected=true', { cookie })).status).toBe(422)
      expect(
        (await request('/api/stock-returns/eligible-releases?status=DRAFT', { cookie })).status,
      ).toBe(422)
      expect((await request('/api/stock-returns/not-a-number', { cookie })).status).toBe(422)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
