import { afterAll, describe, expect, it } from 'vitest'
import { TransactionStatus, UserRole } from '../../generated/prisma/client'
import {
  cancelStockRelease,
  completeStockRelease,
  createStockRelease,
} from '../../server/services/stock-release.service'
import {
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import {
  cancelStockReturn,
  completeStockReturn,
  createStockReturn,
  getStockReturn,
} from '../../server/services/stock-return.service'
import { getStockBalance } from '../../server/services/stock.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function fixture() {
  const admin = await prisma.user.create({
    data: {
      email: 'return-race-admin@example.com',
      displayName: 'Return Race Admin',
      passwordHash: 'unused',
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'return-race-user@example.com',
      displayName: 'Return Race User',
      passwordHash: 'unused',
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Return Race' } })
  const device = await prisma.device.create({ data: { deviceName: 'Return Race Device' } })
  const detail = await prisma.deviceDetail.create({
    data: { deviceId: device.id, partNumber: 'RACE-1', specification: 'Race Part' },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'RACE', rackName: 'Race Rack' } })
  const adjustment = await createStockAdjustmentIn(user.id, {
    transactionDate: '2026-07-18',
    details: [
      {
        deviceDetailId: detail.id.toString(),
        destinationRackId: rack.id.toString(),
        quantity: 3,
      },
    ],
  })
  await completeStockAdjustmentIn(adjustment.id, user.id)
  const release = await completeStockRelease(
    (
      await createStockRelease(user.id, {
        releaseDate: '2026-07-19',
        engineerName: 'Race Engineer',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: rack.id.toString(),
            releasedQuantity: 3,
          },
        ],
      })
    ).id,
    user.id,
  )
  return { admin, user, customer, detail, rack, release, releaseDetail: release.details[0]! }
}

function returnBody(data: Awaited<ReturnType<typeof fixture>>, quantity: number) {
  return {
    returnDate: '2026-07-20',
    stockReleaseId: data.release.id,
    details: [
      {
        stockReleaseDetailId: data.releaseDetail.id,
        destinationRackId: data.rack.id.toString(),
        returnQuantity: quantity,
      },
    ],
  }
}

describe('concurrent Stock Returns', () => {
  it('allows only one concurrent return when their total exceeds the released quantity', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const first = await createStockReturn(data.user.id, returnBody(data, 2))
      const second = await createStockReturn(data.user.id, returnBody(data, 2))

      const results = await Promise.allSettled([
        completeStockReturn(first.id, data.user.id),
        completeStockReturn(second.id, data.user.id),
      ])
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
      const completedQuantity = await prisma.stockReturnDetail.aggregate({
        where: {
          stockReleaseDetailId: BigInt(data.releaseDetail.id),
          stockReturn: { status: TransactionStatus.COMPLETED },
        },
        _sum: { returnQuantity: true },
      })
      expect(completedQuantity._sum.returnQuantity).toBe(2)
    })
  })

  it('serializes return completion against release cancellation using release-detail locks', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const stockReturn = await createStockReturn(data.user.id, returnBody(data, 1))

      const results = await Promise.allSettled([
        completeStockReturn(stockReturn.id, data.user.id),
        cancelStockRelease(data.release.id, data.admin.id),
      ])
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)

      const [release, returned] = await Promise.all([
        prisma.stockRelease.findUniqueOrThrow({ where: { id: BigInt(data.release.id) } }),
        prisma.stockReturn.findUniqueOrThrow({ where: { id: BigInt(stockReturn.id) } }),
      ])
      const completedReturns = await prisma.stockReturn.count({
        where: {
          stockReleaseId: release.id,
          status: TransactionStatus.COMPLETED,
        },
      })
      expect(
        (release.status === TransactionStatus.COMPLETED &&
          returned.status === TransactionStatus.COMPLETED &&
          completedReturns === 1) ||
          (release.status === TransactionStatus.CANCELLED &&
            returned.status === TransactionStatus.DRAFT &&
            completedReturns === 0),
      ).toBe(true)
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(
        release.status === TransactionStatus.CANCELLED ? 3 : 1,
      )
    })
  })

  it('serializes Return cancellation against a Release consuming its destination stock', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const stockReturn = await completeStockReturn(
        (await createStockReturn(data.user.id, returnBody(data, 1))).id,
        data.user.id,
      )
      const consumingRelease = await createStockRelease(data.user.id, {
        releaseDate: '2026-07-21',
        engineerName: 'Destination Race Engineer',
        customerId: data.customer.id.toString(),
        details: [
          {
            deviceDetailId: data.detail.id.toString(),
            sourceRackId: data.rack.id.toString(),
            releasedQuantity: 1,
          },
        ],
      })

      const results = await Promise.allSettled([
        completeStockRelease(consumingRelease.id, data.user.id),
        cancelStockReturn(stockReturn.id, data.admin.id),
      ])
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)

      const [release, returned] = await Promise.all([
        prisma.stockRelease.findUniqueOrThrow({
          where: { id: BigInt(consumingRelease.id) },
        }),
        prisma.stockReturn.findUniqueOrThrow({ where: { id: BigInt(stockReturn.id) } }),
      ])
      expect(
        (release.status === TransactionStatus.COMPLETED &&
          returned.status === TransactionStatus.COMPLETED) ||
          (release.status === TransactionStatus.DRAFT &&
            returned.status === TransactionStatus.CANCELLED),
      ).toBe(true)
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(0)
    })
  })

  it('returns status and returnable quantities from one consistent read snapshot', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const stockReturn = await completeStockReturn(
          (await createStockReturn(data.user.id, returnBody(data, 1))).id,
          data.user.id,
        )
        const [, ...reads] = await Promise.all([
          cancelStockReturn(stockReturn.id, data.admin.id),
          ...Array.from({ length: 8 }, () => getStockReturn(stockReturn.id)),
        ])

        for (const result of reads) {
          const detail = result.details[0]!
          expect(detail.previouslyReturnedQuantity).toBe(0)
          expect(detail.previouslyReturnedQuantity).toBeGreaterThanOrEqual(0)
          if (result.status === TransactionStatus.COMPLETED) {
            expect(detail.remainingReturnableQuantity).toBe(2)
          } else {
            expect(result.status).toBe(TransactionStatus.CANCELLED)
            expect(detail.remainingReturnableQuantity).toBe(3)
          }
        }
      }
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
