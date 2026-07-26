import { hash } from 'argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
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

async function createUser(email: string, role: UserRole) {
  return prisma.user.create({
    data: {
      email,
      displayName: role === UserRole.ADMIN ? 'Inventory Administrator' : 'Inventory User',
      passwordHash,
      role,
      isActive: true,
    },
  })
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

async function jsonRequest(
  path: string,
  cookie?: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
) {
  return fetch(path, {
    method: options.method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
}

async function withActors(
  callback: (actors: { adminCookie: string; userCookie: string }) => Promise<void>,
) {
  await withCleanDatabase(async () => {
    await createUser('admin@example.com', UserRole.ADMIN)
    await createUser('user@example.com', UserRole.USER)
    await callback({
      adminCookie: await login('admin@example.com'),
      userCookie: await login('user@example.com'),
    })
  })
}

async function expectJson(response: Response, status: number) {
  expect(response.status).toBe(status)
  return response.json()
}

describe('master data REST API', () => {
  it('exposes all 24 list/create/get/update routes with JSON-safe DTOs', async () => {
    await withActors(async ({ adminCookie, userCookie }) => {
      const created: Record<string, Record<string, unknown>> = {}
      created.models = await expectJson(
        await jsonRequest('/api/models', adminCookie, {
          method: 'POST',
          body: { modelName: 'PowerEdge R750' },
        }),
        201,
      )
      created.customers = await expectJson(
        await jsonRequest('/api/customers', adminCookie, {
          method: 'POST',
          body: { customerName: 'Acme Support' },
        }),
        201,
      )
      created.devices = await expectJson(
        await jsonRequest('/api/devices', adminCookie, {
          method: 'POST',
          body: { deviceName: 'Hard Disk' },
        }),
        201,
      )
      created.racks = await expectJson(
        await jsonRequest('/api/racks', adminCookie, {
          method: 'POST',
          body: { rackCode: 'A', rackName: 'Rack A' },
        }),
        201,
      )
      created['service-tags'] = await expectJson(
        await jsonRequest('/api/service-tags', adminCookie, {
          method: 'POST',
          body: {
            modelId: created.models!.id,
            customerId: created.customers!.id,
            serviceTag: 'ST-10001',
          },
        }),
        201,
      )
      created['device-details'] = await expectJson(
        await jsonRequest('/api/device-details', adminCookie, {
          method: 'POST',
          body: {
            deviceId: created.devices!.id,
            partNumber: '0B24496',
            dpn: '0B24496',
            specification: '600 GB 15K 3.5-inch 6G SAS',
          },
        }),
        201,
      )

      for (const resource of Object.keys(created)) {
        const id = created[resource]!.id
        expect(id).toMatch(/^\d+$/)
        expect(created[resource]!.createdAt).toEqual(expect.any(String))

        const getResponse = await jsonRequest(`/api/${resource}/${id}`, userCookie)
        expect((await expectJson(getResponse, 200)).id).toBe(id)

        const listResponse = await jsonRequest(`/api/${resource}?page=1&pageSize=20`, userCookie)
        const list = await expectJson(listResponse, 200)
        expect(list).toMatchObject({ page: 1, pageSize: 20, total: 1 })
        expect(list.data[0].id).toBe(id)

        const updateResponse = await jsonRequest(`/api/${resource}/${id}`, adminCookie, {
          method: 'PUT',
          body: { isActive: false },
        })
        expect((await expectJson(updateResponse, 200)).isActive).toBe(false)
      }
    })
  })

  it('requires authentication for reads and Administrator role for writes', async () => {
    await withActors(async ({ adminCookie, userCookie }) => {
      for (const resource of [
        'models',
        'service-tags',
        'devices',
        'device-details',
        'customers',
        'racks',
      ]) {
        const anonymous = await jsonRequest(`/api/${resource}`)
        expect(anonymous.status).toBe(401)
      }

      expect((await jsonRequest('/api/racks', userCookie)).status).toBe(200)
      const forbidden = await jsonRequest('/api/racks', userCookie, {
        method: 'POST',
        body: { rackCode: 'B', rackName: 'Rack B' },
      })
      expect(forbidden.status).toBe(403)

      const allowed = await jsonRequest('/api/racks', adminCookie, {
        method: 'POST',
        body: { rackCode: 'A', rackName: 'Rack A' },
      })
      expect(allowed.status).toBe(201)
    })
  })

  it('rejects unknown DTO and query fields with structured validation errors', async () => {
    await withActors(async ({ adminCookie }) => {
      const bodyResponse = await jsonRequest('/api/models', adminCookie, {
        method: 'POST',
        body: { modelName: 'PowerEdge', unexpected: 'mass assignment attempt' },
      })
      expect(bodyResponse.status).toBe(422)
      await expect(bodyResponse.json()).resolves.toMatchObject({
        data: {
          code: 'VALIDATION_ERROR',
          fieldErrors: { _form: expect.any(Array) },
        },
      })

      const queryResponse = await jsonRequest('/api/models?unknown=true', adminCookie)
      expect(queryResponse.status).toBe(422)
      await expect(queryResponse.json()).resolves.toMatchObject({
        data: { code: 'VALIDATION_ERROR' },
      })

      const idResponse = await jsonRequest('/api/models/not-a-number', adminCookie)
      expect(idResponse.status).toBe(422)
    })
  })

  it('supports search, active, pagination, and parent filters', async () => {
    await withActors(async ({ adminCookie }) => {
      const modelA = await expectJson(
        await jsonRequest('/api/models', adminCookie, {
          method: 'POST',
          body: { modelName: 'PowerEdge Active' },
        }),
        201,
      )
      const modelB = await expectJson(
        await jsonRequest('/api/models', adminCookie, {
          method: 'POST',
          body: { modelName: 'ThinkPad Active' },
        }),
        201,
      )
      const customer = await expectJson(
        await jsonRequest('/api/customers', adminCookie, {
          method: 'POST',
          body: { customerName: 'Filter Customer' },
        }),
        201,
      )
      const deviceA = await expectJson(
        await jsonRequest('/api/devices', adminCookie, {
          method: 'POST',
          body: { deviceName: 'Hard Disk' },
        }),
        201,
      )
      const deviceB = await expectJson(
        await jsonRequest('/api/devices', adminCookie, {
          method: 'POST',
          body: { deviceName: 'Memory' },
        }),
        201,
      )

      for (const [modelId, serviceTag, customerId] of [
        [modelA.id, 'ST-A', customer.id],
        [modelB.id, 'ST-B', null],
      ]) {
        await expectJson(
          await jsonRequest('/api/service-tags', adminCookie, {
            method: 'POST',
            body: { modelId, customerId, serviceTag },
          }),
          201,
        )
      }
      for (const [deviceId, partNumber] of [
        [deviceA.id, 'PART-A'],
        [deviceB.id, 'PART-B'],
      ]) {
        await expectJson(
          await jsonRequest('/api/device-details', adminCookie, {
            method: 'POST',
            body: { deviceId, partNumber, specification: `${partNumber} specification` },
          }),
          201,
        )
      }

      const search = await expectJson(
        await jsonRequest('/api/models?search=power&page=1&pageSize=1', adminCookie),
        200,
      )
      expect(search).toMatchObject({ total: 1, page: 1, pageSize: 1 })
      expect(search.data[0].modelName).toBe('PowerEdge Active')

      const byModel = await expectJson(
        await jsonRequest(`/api/service-tags?modelId=${modelA.id}`, adminCookie),
        200,
      )
      expect(byModel.data.map((item: { serviceTag: string }) => item.serviceTag)).toEqual(['ST-A'])

      const byCustomer = await expectJson(
        await jsonRequest(`/api/service-tags?customerId=${customer.id}`, adminCookie),
        200,
      )
      expect(byCustomer.total).toBe(1)

      const byDevice = await expectJson(
        await jsonRequest(`/api/device-details?deviceId=${deviceB.id}`, adminCookie),
        200,
      )
      expect(byDevice.data[0].partNumber).toBe('PART-B')

      await jsonRequest(`/api/models/${modelB.id}`, adminCookie, {
        method: 'PUT',
        body: { isActive: false },
      })
      const inactive = await expectJson(
        await jsonRequest('/api/models?isActive=false', adminCookie),
        200,
      )
      expect(inactive.data.map((item: { id: string }) => item.id)).toEqual([modelB.id])
    })
  })

  it('rejects inactive parent master data while retaining it on historical detail reads', async () => {
    await withActors(async ({ adminCookie, userCookie }) => {
      const model = await expectJson(
        await jsonRequest('/api/models', adminCookie, {
          method: 'POST',
          body: { modelName: 'Historical Model' },
        }),
        201,
      )
      const device = await expectJson(
        await jsonRequest('/api/devices', adminCookie, {
          method: 'POST',
          body: { deviceName: 'Historical Device' },
        }),
        201,
      )
      const tag = await expectJson(
        await jsonRequest('/api/service-tags', adminCookie, {
          method: 'POST',
          body: { modelId: model.id, serviceTag: 'HISTORY-1' },
        }),
        201,
      )
      const detail = await expectJson(
        await jsonRequest('/api/device-details', adminCookie, {
          method: 'POST',
          body: {
            deviceId: device.id,
            partNumber: 'HISTORY-PART',
            specification: 'Historical part',
          },
        }),
        201,
      )
      await jsonRequest(`/api/models/${model.id}`, adminCookie, {
        method: 'PUT',
        body: { isActive: false },
      })
      await jsonRequest(`/api/devices/${device.id}`, adminCookie, {
        method: 'PUT',
        body: { isActive: false },
      })

      const historicalTag = await expectJson(
        await jsonRequest(`/api/service-tags/${tag.id}`, userCookie),
        200,
      )
      expect(historicalTag.model).toMatchObject({ modelName: 'Historical Model', isActive: false })
      const historicalDetail = await expectJson(
        await jsonRequest(`/api/device-details/${detail.id}`, userCookie),
        200,
      )
      expect(historicalDetail.device).toMatchObject({
        deviceName: 'Historical Device',
        isActive: false,
      })

      const inactiveModel = await jsonRequest('/api/service-tags', adminCookie, {
        method: 'POST',
        body: { modelId: model.id, serviceTag: 'BLOCKED' },
      })
      expect(inactiveModel.status).toBe(422)
      await expect(inactiveModel.json()).resolves.toMatchObject({
        data: { code: 'INACTIVE_MASTER' },
      })

      const inactiveDevice = await jsonRequest('/api/device-details', adminCookie, {
        method: 'POST',
        body: {
          deviceId: device.id,
          partNumber: 'BLOCKED',
          specification: 'Blocked inactive parent',
        },
      })
      expect(inactiveDevice.status).toBe(422)
    })
  })
})

beforeAll(async () => {
  passwordHash = await hash(TEST_PASSWORD)
})

afterAll(async () => {
  await prisma.$disconnect()
})
