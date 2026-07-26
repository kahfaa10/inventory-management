import { afterAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import {
  completeStockRelease,
  createStockRelease,
} from '../../server/services/stock-release.service'
import {
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import { getStockBalance } from '../../server/services/stock.service'
import { prisma, withCleanDatabase } from '../helpers/database'

describe('concurrent stock release', () => {
  it('allows exactly one request to take the final stock', async () => {
    await withCleanDatabase(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'concurrent-release@example.com',
          displayName: 'Concurrent Release',
          passwordHash: 'unused',
          role: UserRole.USER,
        },
      })
      const customer = await prisma.customer.create({ data: { customerName: 'Concurrency' } })
      const device = await prisma.device.create({ data: { deviceName: 'SSD' } })
      const detail = await prisma.deviceDetail.create({
        data: { deviceId: device.id, partNumber: 'SSD-1', specification: '1 TB' },
      })
      const rack = await prisma.rack.create({ data: { rackCode: 'C', rackName: 'Rack C' } })
      const adjustment = await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-19',
        details: [
          {
            deviceDetailId: detail.id.toString(),
            destinationRackId: rack.id.toString(),
            quantity: 1,
          },
        ],
      })
      await completeStockAdjustmentIn(adjustment.id, user.id)
      const body = {
        releaseDate: '2026-07-20',
        engineerName: 'Engineer',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: rack.id.toString(),
            releasedQuantity: 1,
          },
        ],
      }
      const first = await createStockRelease(user.id, body)
      const second = await createStockRelease(user.id, body)

      const results = await Promise.allSettled([
        completeStockRelease(first.id, user.id),
        completeStockRelease(second.id, user.id),
      ])

      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
      const rejection = results.find(({ status }) => status === 'rejected')
      if (rejection?.status === 'rejected') {
        expect(rejection.reason).toMatchObject({
          statusCode: 409,
          code: 'INSUFFICIENT_STOCK',
          message: expect.stringContaining('Available quantity: 0'),
        })
      }
      await expect(getStockBalance(prisma, detail.id, rack.id)).resolves.toBe(0)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
