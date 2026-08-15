import { afterAll, describe, expect, it } from 'vitest'
import {
  MovementPurpose,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../../generated/prisma/client'
import {
  cancelStockRelease,
  completeStockRelease,
  createStockRelease,
  getStockReleaseReturnable,
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
  listEligibleStockReleases,
  listStockReturns,
  updateStockReturn,
} from '../../server/services/stock-return.service'
import { getStockBalance } from '../../server/services/stock.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function fixture(releasedQuantity = 3) {
  const admin = await prisma.user.create({
    data: {
      email: 'return-admin@example.com',
      displayName: 'Return Admin',
      passwordHash: 'unused',
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'return-user@example.com',
      displayName: 'Return User',
      passwordHash: 'unused',
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Return Customer' } })
  const device = await prisma.device.create({ data: { deviceName: 'Return Disk' } })
  const deviceDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'RETURN-DISK-1',
      specification: '600 GB SAS',
    },
  })
  const otherDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'RETURN-DISK-2',
      specification: '1.2 TB SAS',
    },
  })
  const sourceRack = await prisma.rack.create({
    data: { rackCode: 'RETURN-A', rackName: 'Return Rack A' },
  })
  const destinationRack = await prisma.rack.create({
    data: { rackCode: 'RETURN-B', rackName: 'Return Rack B' },
  })
  const adjustment = await createStockAdjustmentIn(user.id, {
    transactionDate: '2026-07-18',
    details: [
      {
        deviceDetailId: deviceDetail.id.toString(),
        destinationRackId: sourceRack.id.toString(),
        quantity: releasedQuantity,
      },
    ],
  })
  await completeStockAdjustmentIn(adjustment.id, user.id)
  const release = await createStockRelease(user.id, {
    releaseDate: '2026-07-19',
    engineerName: 'Return Engineer',
    customerId: customer.id.toString(),
    details: [
      {
        deviceDetailId: deviceDetail.id.toString(),
        sourceRackId: sourceRack.id.toString(),
        releasedQuantity,
      },
    ],
  })
  const completedRelease = await completeStockRelease(release.id, user.id)
  return {
    admin,
    user,
    customer,
    device,
    deviceDetail,
    otherDetail,
    sourceRack,
    destinationRack,
    release: completedRelease,
    releaseDetail: completedRelease.details[0]!,
  }
}

function returnInput(
  data: Awaited<ReturnType<typeof fixture>>,
  quantity = 1,
  overrides: Record<string, unknown> = {},
) {
  return {
    returnDate: '2026-07-20',
    stockReleaseId: data.release.id,
    notes: 'Returned after service',
    details: [
      {
        stockReleaseDetailId: data.releaseDetail.id,
        destinationRackId: data.destinationRack.id.toString(),
        returnQuantity: quantity,
        notes: 'Return line',
      },
    ],
    ...overrides,
  }
}

describe('stock return service', () => {
  it('creates SRT drafts, inherits release fields, lists eligible releases, and supports draft update', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockReturn(data.user.id, returnInput(data))

      expect(draft).toMatchObject({
        transactionNumber: 'SRT-202607-0001',
        status: TransactionStatus.DRAFT,
        engineerName: 'Return Engineer',
        customerId: data.customer.id.toString(),
        details: [
          {
            releasedQuantity: 3,
            previouslyReturnedQuantity: 0,
            remainingReturnableQuantity: 3,
          },
        ],
      })
      await expect(
        getStockBalance(prisma, data.deviceDetail.id, data.destinationRack.id),
      ).resolves.toBe(0)
      await expect(listEligibleStockReleases({ search: 'Return Engineer' })).resolves.toMatchObject(
        {
          total: 1,
          data: [{ id: data.release.id, details: [{ remainingReturnableQuantity: 3 }] }],
        },
      )
      await expect(
        listStockReturns({
          search: 'Return Engineer',
          status: 'DRAFT',
          stockReleaseId: data.release.id,
          customerId: data.customer.id.toString(),
          dateFrom: '2026-07-20',
          dateTo: '2026-07-20',
        }),
      ).resolves.toMatchObject({ total: 1, data: [{ id: draft.id }] })

      const updated = await updateStockReturn(data.user.id, draft.id, returnInput(data, 2))
      expect(updated.details[0]?.returnQuantity).toBe(2)
    })
  })

  it('supports partial and cross-rack returns with idempotent Quantity In posting', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const first = await completeStockReturn(
        (await createStockReturn(data.user.id, returnInput(data, 1))).id,
        data.user.id,
      )
      await expect(completeStockReturn(first.id, data.user.id)).resolves.toMatchObject({
        status: TransactionStatus.COMPLETED,
      })
      expect(first.details[0]).toMatchObject({
        releasedQuantity: 3,
        previouslyReturnedQuantity: 0,
        remainingReturnableQuantity: 2,
        returnQuantity: 1,
      })
      await expect(
        getStockBalance(prisma, data.deviceDetail.id, data.destinationRack.id),
      ).resolves.toBe(1)
      await expect(getStockReleaseReturnable(data.release.id)).resolves.toMatchObject({
        details: [{ completedReturnedQuantity: 1, remainingReturnableQuantity: 2 }],
      })
      await expect(
        prisma.stockMovement.count({
          where: {
            transactionType: TransactionType.STOCK_RETURN,
            transactionId: BigInt(first.id),
            movementPurpose: MovementPurpose.ORIGINAL,
          },
        }),
      ).resolves.toBe(1)

      const second = await completeStockReturn(
        (await createStockReturn(data.user.id, returnInput(data, 2))).id,
        data.user.id,
      )
      expect(second.details[0]).toMatchObject({
        previouslyReturnedQuantity: 1,
        remainingReturnableQuantity: 0,
      })
      await expect(listEligibleStockReleases()).resolves.toMatchObject({ total: 0, data: [] })
      await expect(createStockReturn(data.user.id, returnInput(data, 1))).rejects.toMatchObject({
        statusCode: 409,
        code: 'RETURN_QUANTITY_EXCEEDED',
      })
    })
  })

  it('aggregates duplicate release-detail references before remaining validation', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture(3)
      const input = returnInput(data, 2)
      input.details.push({
        stockReleaseDetailId: data.releaseDetail.id,
        destinationRackId: data.destinationRack.id.toString(),
        returnQuantity: 2,
        notes: 'Duplicate detail',
      })
      await expect(createStockReturn(data.user.id, input)).rejects.toMatchObject({
        statusCode: 409,
        code: 'RETURN_QUANTITY_EXCEEDED',
        fieldErrors: {
          'details.0.returnQuantity': [expect.stringContaining('Remaining returnable quantity: 3')],
          'details.1.returnQuantity': [expect.stringContaining('Remaining returnable quantity: 3')],
        },
      })
      await expect(prisma.stockReturn.count()).resolves.toBe(0)
    })
  })

  it('rejects non-completed releases, mismatched details, and inactive destination racks', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const otherRelease = await prisma.stockRelease.create({
        data: {
          transactionNumber: 'SRL-202607-9999',
          releaseDate: new Date('2026-07-19'),
          engineerName: 'Other Engineer',
          customerId: data.customer.id,
          createdById: data.user.id,
          details: {
            create: {
              deviceDetailId: data.otherDetail.id,
              rackId: data.sourceRack.id,
              releasedQuantity: 1,
            },
          },
        },
        include: { details: true },
      })

      await expect(
        createStockReturn(
          data.user.id,
          returnInput(data, 1, { stockReleaseId: otherRelease.id.toString() }),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSACTION_STATE' })

      await prisma.stockRelease.update({
        where: { id: otherRelease.id },
        data: { status: TransactionStatus.COMPLETED },
      })
      await expect(
        createStockReturn(data.user.id, {
          ...returnInput(data),
          details: [
            {
              ...returnInput(data).details[0],
              stockReleaseDetailId: otherRelease.details[0]!.id.toString(),
            },
          ],
        }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'RELEASE_DETAIL_MISMATCH' })

      await prisma.rack.update({
        where: { id: data.destinationRack.id },
        data: { isActive: false },
      })
      await expect(createStockReturn(data.user.id, returnInput(data))).rejects.toMatchObject({
        statusCode: 422,
        code: 'INACTIVE_MASTER',
      })
    })
  })

  it('revalidates release status, quantities, and active racks atomically at completion', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const firstDraft = await createStockReturn(data.user.id, returnInput(data, 2))
      const secondDraft = await createStockReturn(data.user.id, returnInput(data, 2))
      await completeStockReturn(firstDraft.id, data.user.id)
      await expect(completeStockReturn(secondDraft.id, data.user.id)).rejects.toMatchObject({
        code: 'RETURN_QUANTITY_EXCEEDED',
      })
      await expect(
        prisma.stockMovement.count({
          where: {
            transactionType: TransactionType.STOCK_RETURN,
            transactionId: BigInt(secondDraft.id),
          },
        }),
      ).resolves.toBe(0)

      const thirdDraft = await createStockReturn(data.user.id, returnInput(data, 1))
      await prisma.rack.update({
        where: { id: data.destinationRack.id },
        data: { isActive: false },
      })
      await expect(completeStockReturn(thirdDraft.id, data.user.id)).rejects.toMatchObject({
        code: 'INACTIVE_MASTER',
      })
      await expect(getStockReturn(thirdDraft.id)).resolves.toMatchObject({
        status: TransactionStatus.DRAFT,
      })
    })
  })

  it('allows returns from historical releases after Customer and released Device masters deactivate', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      await prisma.customer.update({
        where: { id: data.customer.id },
        data: { isActive: false },
      })
      await prisma.deviceDetail.update({
        where: { id: data.deviceDetail.id },
        data: { isActive: false },
      })
      await prisma.device.update({
        where: { id: data.device.id },
        data: { isActive: false },
      })

      await expect(
        completeStockReturn(
          (await createStockReturn(data.user.id, returnInput(data, 1))).id,
          data.user.id,
        ),
      ).resolves.toMatchObject({
        status: TransactionStatus.COMPLETED,
        customer: { isActive: false },
        details: [{ deviceDetail: { isActive: false } }],
      })
      await expect(
        getStockBalance(prisma, data.deviceDetail.id, data.destinationRack.id),
      ).resolves.toBe(1)
    })
  })

  it('cancels drafts and completed returns with linked reversal movements', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockReturn(data.user.id, returnInput(data, 1))
      await expect(cancelStockReturn(draft.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })

      const completed = await completeStockReturn(
        (await createStockReturn(data.user.id, returnInput(data, 1))).id,
        data.user.id,
      )
      await cancelStockReturn(completed.id, data.admin.id)
      await expect(cancelStockReturn(completed.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })
      await expect(
        getStockBalance(prisma, data.deviceDetail.id, data.destinationRack.id),
      ).resolves.toBe(0)
      await expect(getStockReleaseReturnable(data.release.id)).resolves.toMatchObject({
        details: [{ remainingReturnableQuantity: 3 }],
      })
      const movements = await prisma.stockMovement.findMany({
        where: {
          transactionType: TransactionType.STOCK_RETURN,
          transactionId: BigInt(completed.id),
        },
        orderBy: { id: 'asc' },
      })
      expect(movements).toHaveLength(2)
      expect(movements[1]).toMatchObject({
        movementPurpose: MovementPurpose.CANCELLATION_REVERSAL,
        reversalOfId: movements[0]!.id,
        quantityIn: 0,
        quantityOut: 1,
      })
      await expect(cancelStockRelease(data.release.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })
    })
  })

  it('rejects cancellation when returned destination stock has been consumed', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const completed = await completeStockReturn(
        (await createStockReturn(data.user.id, returnInput(data, 1))).id,
        data.user.id,
      )
      const consumption = await createStockRelease(data.user.id, {
        releaseDate: '2026-07-21',
        engineerName: 'Consumption Engineer',
        customerId: data.customer.id.toString(),
        details: [
          {
            deviceDetailId: data.deviceDetail.id.toString(),
            sourceRackId: data.destinationRack.id.toString(),
            releasedQuantity: 1,
          },
        ],
      })
      await completeStockRelease(consumption.id, data.user.id)

      await expect(cancelStockReturn(completed.id, data.admin.id)).rejects.toMatchObject({
        statusCode: 409,
        code: 'INSUFFICIENT_STOCK_FOR_CANCELLATION',
      })
      await expect(getStockReturn(completed.id)).resolves.toMatchObject({
        status: TransactionStatus.COMPLETED,
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
