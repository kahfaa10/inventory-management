import { setup, fetch } from '@nuxt/test-utils/e2e'
import { hash } from 'argon2'
import ExcelJS from 'exceljs'
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
      email: 'excel-api@example.com',
      displayName: 'Excel API User',
      passwordHash,
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Excel API Customer' } })
  const device = await prisma.device.create({ data: { deviceName: 'Excel API Device' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'EXCEL-API-PART',
      specification: 'Excel API specification',
    },
  })
  const rack = await prisma.rack.create({
    data: { rackCode: 'EXCEL-API', rackName: 'Excel API Rack' },
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
  await completeStockRelease(
    (
      await createStockRelease(user.id, {
        releaseDate: '2026-07-02',
        engineerName: 'Excel API Engineer',
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
  return { user, customer }
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

describe('Report Excel APIs over genuine Nitro HTTP', () => {
  it('secures and downloads valid XLSX workbooks from all six routes', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const customerId = data.customer.id.toString()
      const routes = [
        '/api/reports/stock-card/export?dateFrom=2026-07-01',
        `/api/reports/stock-card-by-customer/export?customerId=${customerId}`,
        '/api/reports/stock-in/export',
        `/api/reports/stock-in-by-customer/export?customerId=${customerId}`,
        '/api/reports/stock-out/export',
        `/api/reports/stock-out-by-customer/export?customerId=${customerId}`,
      ]

      for (const route of routes) {
        expect((await fetch(route)).status).toBe(401)
      }

      const cookie = await login(data.user.email)
      for (const route of routes) {
        const response = await fetch(route, { headers: { cookie } })
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        expect(response.headers.get('content-disposition')).toMatch(
          /^attachment; filename="[a-z0-9-]+-\d{8}T\d{6}Z\.xlsx"$/,
        )
        expect(response.headers.get('cache-control')).toBe('no-store')
        const buffer = new Uint8Array(await response.arrayBuffer())
        expect(String.fromCharCode(...buffer.subarray(0, 2))).toBe('PK')
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer as never)
        expect(workbook.worksheets).toHaveLength(1)
        expect(workbook.worksheets[0]!.rowCount).toBeGreaterThan(5)
      }
    })
  })

  it('requires customerId and validates export filters', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const cookie = await login(data.user.email)
      for (const route of [
        '/api/reports/stock-card-by-customer/export',
        '/api/reports/stock-in-by-customer/export',
        '/api/reports/stock-out-by-customer/export',
      ]) {
        expect((await fetch(route, { headers: { cookie } })).status).toBe(422)
      }
      expect(
        (
          await fetch('/api/reports/stock-card/export?unexpected=true', {
            headers: { cookie },
          })
        ).status,
      ).toBe(422)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
