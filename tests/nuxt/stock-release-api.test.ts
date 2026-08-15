import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import {
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
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

async function createFixture(stock = 10) {
  const admin = await prisma.user.create({
    data: {
      email: 'release-admin-api@example.com',
      displayName: 'Release Administrator',
      passwordHash,
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'release-user-api@example.com',
      displayName: 'Release User',
      passwordHash,
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Release API Customer' } })
  const model = await prisma.model.create({ data: { modelName: 'PowerEdge R750' } })
  const serviceTag = await prisma.serviceTag.create({
    data: {
      serviceTag: 'API-TAG',
      modelId: model.id,
      customerId: customer.id,
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Release API SSD' } })
  const detail = await prisma.deviceDetail.create({
    data: { deviceId: device.id, partNumber: 'SSD-API', specification: '1 TB' },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'API-R', rackName: 'API Rack' } })
  const adjustment = await createStockAdjustmentIn(user.id, {
    transactionDate: '2026-07-18',
    details: [
      {
        deviceDetailId: detail.id.toString(),
        destinationRackId: rack.id.toString(),
        quantity: stock,
      },
    ],
  })
  await completeStockAdjustmentIn(adjustment.id, user.id)
  return { admin, user, customer, model, serviceTag, device, detail, rack }
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

function releaseBody(fixture: Awaited<ReturnType<typeof createFixture>>, quantity = 3) {
  return {
    releaseDate: '2026-07-19',
    engineerName: 'API Engineer',
    customerId: fixture.customer.id.toString(),
    modelId: fixture.model.id.toString(),
    serviceTagId: fixture.serviceTag.id.toString(),
    referenceNumber: 'INC-API',
    notes: 'HTTP release',
    details: [
      {
        deviceDetailId: fixture.detail.id.toString(),
        sourceRackId: fixture.rack.id.toString(),
        releasedQuantity: quantity,
        notes: 'Release line',
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

describe('Stock Release API over genuine Nitro HTTP', () => {
  it('allows authenticated Users through draft CRUD, completion, and returnable reads', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture()
      const cookie = await login(fixture.user.email)

      expect((await request('/api/stock-releases')).status).toBe(401)
      const createResponse = await request('/api/stock-releases', {
        cookie,
        method: 'POST',
        body: releaseBody(fixture),
      })
      expect(createResponse.status).toBe(201)
      const created = await createResponse.json()
      expect(created).toMatchObject({
        transactionNumber: 'SRL-202607-0001',
        status: 'DRAFT',
        engineerName: 'API Engineer',
        details: [{ releasedQuantity: 3, availableQuantity: 10 }],
      })

      const listResponse = await request('/api/stock-releases?search=API&status=DRAFT', { cookie })
      expect(listResponse.status).toBe(200)
      await expect(listResponse.json()).resolves.toMatchObject({
        total: 1,
        data: [{ id: created.id }],
      })
      expect((await request(`/api/stock-releases/${created.id}`, { cookie })).status).toBe(200)

      const updateResponse = await request(`/api/stock-releases/${created.id}`, {
        cookie,
        method: 'PUT',
        body: releaseBody(fixture, 4),
      })
      expect(updateResponse.status).toBe(200)
      await expect(updateResponse.json()).resolves.toMatchObject({
        details: [{ releasedQuantity: 4, availableQuantity: 10 }],
      })

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const completeResponse = await request(`/api/stock-releases/${created.id}/complete`, {
          cookie,
          method: 'POST',
        })
        expect(completeResponse.status).toBe(200)
        await expect(completeResponse.json()).resolves.toMatchObject({ status: 'COMPLETED' })
      }
      await expect(getStockBalance(prisma, fixture.detail.id, fixture.rack.id)).resolves.toBe(6)

      const returnableResponse = await request(`/api/stock-releases/${created.id}/returnable`, {
        cookie,
      })
      expect(returnableResponse.status).toBe(200)
      await expect(returnableResponse.json()).resolves.toMatchObject({
        id: created.id,
        details: [
          {
            releasedQuantity: 4,
            completedReturnedQuantity: 0,
            remainingReturnableQuantity: 4,
          },
        ],
      })
    })
  })

  it('enforces Admin-only cancellation and exposes current availability on oversell', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture(2)
      const userCookie = await login(fixture.user.email)
      const adminCookie = await login(fixture.admin.email)
      const createdResponse = await request('/api/stock-releases', {
        cookie: userCookie,
        method: 'POST',
        body: releaseBody(fixture, 3),
      })
      const created = await createdResponse.json()

      const completeResponse = await request(`/api/stock-releases/${created.id}/complete`, {
        cookie: userCookie,
        method: 'POST',
      })
      expect(completeResponse.status).toBe(409)
      await expect(completeResponse.json()).resolves.toMatchObject({
        data: {
          code: 'INSUFFICIENT_STOCK',
          message: expect.stringContaining('Available quantity: 2'),
          fieldErrors: {
            'details.0.releasedQuantity': [expect.stringContaining('Available quantity: 2')],
          },
        },
      })

      const valid = await request(`/api/stock-releases/${created.id}`, {
        cookie: userCookie,
        method: 'PUT',
        body: releaseBody(fixture, 2),
      })
      expect(valid.status).toBe(200)
      await request(`/api/stock-releases/${created.id}/complete`, {
        cookie: userCookie,
        method: 'POST',
      })
      expect(
        (
          await request(`/api/stock-releases/${created.id}/cancel`, {
            cookie: userCookie,
            method: 'POST',
          })
        ).status,
      ).toBe(403)
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const cancelResponse = await request(`/api/stock-releases/${created.id}/cancel`, {
          cookie: adminCookie,
          method: 'POST',
        })
        expect(cancelResponse.status).toBe(200)
        await expect(cancelResponse.json()).resolves.toMatchObject({ status: 'CANCELLED' })
      }
      await expect(getStockBalance(prisma, fixture.detail.id, fixture.rack.id)).resolves.toBe(2)
    })
  })

  it('strictly validates body, query, IDs, required fields, and PostgreSQL Int boundaries', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createFixture()
      const cookie = await login(fixture.user.email)
      const body = releaseBody(fixture)

      const maximumResponse = await request('/api/stock-releases', {
        cookie,
        method: 'POST',
        body: releaseBody(fixture, POSTGRES_SIGNED_INTEGER_MAX),
      })
      expect(maximumResponse.status).toBe(201)
      await expect(maximumResponse.json()).resolves.toMatchObject({
        details: [{ releasedQuantity: POSTGRES_SIGNED_INTEGER_MAX }],
      })

      for (const invalidBody of [
        { ...body, status: 'COMPLETED' },
        { ...body, engineerName: '   ' },
        { ...body, customerId: undefined },
        { ...body, details: [] },
        { ...body, details: [{ ...body.details[0], releasedQuantity: 0 }] },
        {
          ...body,
          details: [
            {
              ...body.details[0],
              releasedQuantity: POSTGRES_SIGNED_INTEGER_MAX + 1,
            },
          ],
        },
      ]) {
        const response = await request('/api/stock-releases', {
          cookie,
          method: 'POST',
          body: invalidBody,
        })
        expect(response.status).toBe(422)
        await expect(response.json()).resolves.toMatchObject({
          data: { code: 'VALIDATION_ERROR' },
        })
      }

      expect((await request('/api/stock-releases?unexpected=true', { cookie })).status).toBe(422)
      expect((await request('/api/stock-releases?isActive=true', { cookie })).status).toBe(422)
      expect((await request('/api/stock-releases/not-a-number', { cookie })).status).toBe(422)
      expect(
        (await request('/api/stock-releases/not-a-number/returnable', { cookie })).status,
      ).toBe(422)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
