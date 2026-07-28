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
import { completeStockReturn, createStockReturn } from '../../server/services/stock-return.service'
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
  const user = await prisma.user.create({
    data: {
      email: 'report-api@example.com',
      displayName: 'Report API User',
      passwordHash,
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({
    data: { customerName: 'Report API Customer' },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Report API Device' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'REPORT-API-PART',
      dpn: 'REPORT-API-DPN',
      specification: 'Report API specification',
    },
  })
  const rack = await prisma.rack.create({
    data: { rackCode: 'REPORT-API', rackName: 'Report API Rack' },
  })
  await completeStockAdjustmentIn(
    (
      await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-01',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            destinationRackId: rack.id.toString(),
            quantity: 3,
          },
        ],
      })
    ).id,
    user.id,
  )
  const release = await completeStockRelease(
    (
      await createStockRelease(user.id, {
        releaseDate: '2026-07-02',
        engineerName: 'Report API Engineer',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: rack.id.toString(),
            releasedQuantity: 1,
          },
        ],
      })
    ).id,
    user.id,
  )
  await completeStockReturn(
    (
      await createStockReturn(user.id, {
        returnDate: '2026-07-03',
        stockReleaseId: release.id,
        details: [
          {
            stockReleaseDetailId: release.details[0]!.id,
            destinationRackId: rack.id.toString(),
            returnQuantity: 1,
          },
        ],
      })
    ).id,
    user.id,
  )
  return { user, customer, detail, rack }
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

function reportRequest(path: string, cookie?: string) {
  return fetch(path, {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('Report APIs over genuine Nitro HTTP', () => {
  it('secures all six routes and returns ledger-backed general and customer reports', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const customerId = data.customer.id.toString()
      const routes = [
        '/api/reports/stock-card',
        `/api/reports/stock-card-by-customer?customerId=${customerId}`,
        '/api/reports/stock-in',
        `/api/reports/stock-in-by-customer?customerId=${customerId}`,
        '/api/reports/stock-out',
        `/api/reports/stock-out-by-customer?customerId=${customerId}`,
      ]
      for (const route of routes) {
        expect((await reportRequest(route)).status).toBe(401)
      }

      const cookie = await login(data.user.email)
      const stockCard = await (
        await reportRequest(
          `/api/reports/stock-card?deviceDetailId=${data.detail.id}&rackId=${data.rack.id}`,
          cookie,
        )
      ).json()
      expect(
        stockCard.rows.map(
          (row: { quantityIn: number; quantityOut: number; runningBalance: number }) => [
            row.quantityIn,
            row.quantityOut,
            row.runningBalance,
          ],
        ),
      ).toEqual([
        [3, 0, 3],
        [0, 1, 2],
        [1, 0, 3],
      ])

      const stockIn = await (await reportRequest('/api/reports/stock-in', cookie)).json()
      expect(stockIn.rows.map((row: { stockInType: string }) => row.stockInType)).toEqual([
        'Adjustment In',
        'Return',
      ])

      const stockOut = await (await reportRequest('/api/reports/stock-out', cookie)).json()
      expect(stockOut).toMatchObject({
        total: 1,
        rows: [{ engineerName: 'Report API Engineer', releasedQuantity: 1 }],
      })

      for (const route of routes.filter((route) => route.includes('by-customer'))) {
        const response = await reportRequest(route, cookie)
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.total).toBeGreaterThan(0)
        expect(
          body.rows.every((row: { customerId: string }) => row.customerId === customerId),
        ).toBe(true)
      }
    })
  })

  it('strictly validates customer variants and report filters', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const cookie = await login(data.user.email)
      for (const path of [
        '/api/reports/stock-card-by-customer',
        '/api/reports/stock-in-by-customer',
        '/api/reports/stock-out-by-customer',
      ]) {
        expect((await reportRequest(path, cookie)).status).toBe(422)
      }
      expect(
        (
          await reportRequest(
            `/api/reports/stock-card?deviceDetailId=${data.detail.id}&unexpected=true`,
            cookie,
          )
        ).status,
      ).toBe(422)
      expect(
        (
          await reportRequest(
            '/api/reports/stock-card?dateFrom=2026-07-03&dateTo=2026-07-01',
            cookie,
          )
        ).status,
      ).toBe(422)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
