import { afterAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import {
  createCustomer,
  createDevice,
  createDeviceDetail,
  createModel,
  createRack,
  createServiceTag,
  listModels,
  updateDeviceDetail,
  updateServiceTag,
} from '../../server/services/master.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function createAdmin() {
  return prisma.user.create({
    data: {
      email: 'admin@example.com',
      displayName: 'Inventory Admin',
      passwordHash: 'not-used-by-master-tests',
      role: UserRole.ADMIN,
    },
  })
}

describe('master services', () => {
  it.each([
    ['Model Name', createModel, { modelName: 'PowerEdge R750' }, { modelName: ' poweredge r750 ' }],
    ['Service Tag', null, null, null],
    ['Device Name', createDevice, { deviceName: 'Hard Disk' }, { deviceName: ' hard disk ' }],
    [
      'Customer Name',
      createCustomer,
      { customerName: 'Acme Corp' },
      { customerName: ' ACME CORP ' },
    ],
    [
      'Rack Code',
      createRack,
      { rackCode: 'RACK-A', rackName: 'Rack A' },
      { rackCode: ' rack-a ', rackName: 'Other name' },
    ],
  ] as const)('rejects duplicate %s case-insensitively', async (name, create, first, duplicate) => {
    if (name === 'Service Tag') return

    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      await create(admin.id, first)

      await expect(create(admin.id, duplicate)).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RECORD',
        message: 'Duplicate record already exists.',
      })
    })
  })

  it('rejects duplicate Service Tags case-insensitively', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      const model = await createModel(admin.id, { modelName: 'PowerEdge R750' })
      await createServiceTag(admin.id, { modelId: model.id, serviceTag: 'ST-001' })

      await expect(
        createServiceTag(admin.id, { modelId: model.id, serviceTag: ' st-001 ' }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_RECORD' })
    })
  })

  it('uses device + Part Number + nullable DP/N as the Device Detail identity', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      const device = await createDevice(admin.id, { deviceName: 'Hard Disk' })
      const otherDevice = await createDevice(admin.id, { deviceName: 'SSD' })

      await createDeviceDetail(admin.id, {
        deviceId: device.id,
        partNumber: 'PN-1',
        dpn: null,
        specification: '600 GB SAS',
      })

      await expect(
        createDeviceDetail(admin.id, {
          deviceId: device.id,
          partNumber: ' pn-1 ',
          dpn: null,
          specification: 'Different text',
        }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_RECORD' })

      await expect(
        createDeviceDetail(admin.id, {
          deviceId: device.id,
          partNumber: 'PN-1',
          dpn: 'DPN-2',
          specification: '600 GB SAS',
        }),
      ).resolves.toMatchObject({ dpn: 'DPN-2' })

      await expect(
        createDeviceDetail(admin.id, {
          deviceId: otherDevice.id,
          partNumber: 'PN-1',
          dpn: null,
          specification: '600 GB SAS',
        }),
      ).resolves.toMatchObject({ deviceId: otherDevice.id })
    })
  })

  it('requires active parents on create and reassignment but preserves an unchanged inactive parent', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      const inactiveModel = await createModel(admin.id, {
        modelName: 'Inactive Model',
        isActive: false,
      })
      const activeModel = await createModel(admin.id, { modelName: 'Active Model' })
      const inactiveCustomer = await createCustomer(admin.id, {
        customerName: 'Inactive Customer',
        isActive: false,
      })

      await expect(
        createServiceTag(admin.id, {
          modelId: inactiveModel.id,
          serviceTag: 'BLOCKED',
        }),
      ).rejects.toMatchObject({
        code: 'INACTIVE_MASTER',
        message: 'Selected master data is inactive.',
      })

      await expect(
        createServiceTag(admin.id, {
          modelId: activeModel.id,
          customerId: inactiveCustomer.id,
          serviceTag: 'BLOCKED-CUSTOMER',
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_MASTER' })

      const historicalTag = await prisma.serviceTag.create({
        data: {
          modelId: inactiveModel.id,
          serviceTag: 'HISTORICAL',
        },
      })

      await expect(
        updateServiceTag(admin.id, historicalTag.id.toString(), {
          description: 'Retained historical relationship',
        }),
      ).resolves.toMatchObject({ modelId: inactiveModel.id.toString() })

      await expect(
        updateServiceTag(admin.id, historicalTag.id.toString(), {
          modelId: activeModel.id,
          customerId: inactiveCustomer.id,
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_MASTER' })
    })
  })

  it('applies the same active-parent rules to Device Detail updates', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      const inactiveDevice = await createDevice(admin.id, {
        deviceName: 'Inactive Device',
        isActive: false,
      })
      const activeDevice = await createDevice(admin.id, { deviceName: 'Active Device' })

      await expect(
        createDeviceDetail(admin.id, {
          deviceId: inactiveDevice.id,
          partNumber: 'BLOCKED',
          specification: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_MASTER' })

      const historicalDetail = await prisma.deviceDetail.create({
        data: {
          deviceId: inactiveDevice.id,
          partNumber: 'HISTORICAL',
          specification: 'Historical',
        },
      })

      await expect(
        updateDeviceDetail(admin.id, historicalDetail.id.toString(), {
          description: 'Retained historical relationship',
        }),
      ).resolves.toMatchObject({ deviceId: inactiveDevice.id.toString() })

      await expect(
        updateDeviceDetail(admin.id, historicalDetail.id.toString(), {
          deviceId: inactiveDevice.id,
        }),
      ).resolves.toMatchObject({ deviceId: inactiveDevice.id.toString() })

      await expect(
        updateDeviceDetail(admin.id, historicalDetail.id.toString(), {
          deviceId: activeDevice.id,
        }),
      ).resolves.toMatchObject({ deviceId: activeDevice.id.toString() })

      const activeDetail = await createDeviceDetail(admin.id, {
        deviceId: activeDevice.id,
        partNumber: 'CURRENT',
        specification: 'Current',
      })

      await expect(
        updateDeviceDetail(admin.id, activeDetail.id, {
          deviceId: inactiveDevice.id,
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_MASTER' })
    })
  })

  it('supports search, active filtering, stable pagination, and JSON-safe DTOs', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      await createModel(admin.id, { modelName: 'PowerEdge R740' })
      await createModel(admin.id, { modelName: 'PowerEdge R750' })
      await createModel(admin.id, { modelName: 'PowerStore 500T', isActive: false })

      const page = await listModels({
        page: 1,
        pageSize: 1,
        search: ' poweredge ',
        isActive: true,
      })

      expect(page).toMatchObject({ page: 1, pageSize: 1, total: 2 })
      expect(page.data).toHaveLength(1)
      expect(page.data[0]).toMatchObject({
        modelName: 'PowerEdge R740',
        isActive: true,
      })
      expect(typeof page.data[0]?.id).toBe('string')
      expect(typeof page.data[0]?.createdAt).toBe('string')
      expect(() => JSON.stringify(page)).not.toThrow()
    })
  })

  it('returns structured not-found errors on update', async () => {
    await withCleanDatabase(async () => {
      const admin = await createAdmin()
      await expect(
        updateServiceTag(admin.id, '999999', { description: 'Missing' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
