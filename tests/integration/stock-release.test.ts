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
  getStockRelease,
  getStockReleaseReturnable,
  listStockReleases,
  updateStockRelease,
} from '../../server/services/stock-release.service'
import {
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import { getStockBalance } from '../../server/services/stock.service'
import { POSTGRES_SIGNED_INTEGER_MAX } from '../../shared/schemas/common'
import { prisma, withCleanDatabase } from '../helpers/database'

async function fixture(stock = 10) {
  const admin = await prisma.user.create({
    data: {
      email: 'release-admin@example.com',
      displayName: 'Release Admin',
      passwordHash: 'unused',
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'release-user@example.com',
      displayName: 'Release User',
      passwordHash: 'unused',
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Release Customer' } })
  const otherCustomer = await prisma.customer.create({ data: { customerName: 'Other Customer' } })
  const model = await prisma.model.create({ data: { modelName: 'PowerEdge R750' } })
  const otherModel = await prisma.model.create({ data: { modelName: 'PowerEdge R760' } })
  const serviceTag = await prisma.serviceTag.create({
    data: {
      serviceTag: 'TAG-R750',
      modelId: model.id,
      customerId: customer.id,
    },
  })
  const unassignedServiceTag = await prisma.serviceTag.create({
    data: {
      serviceTag: 'TAG-UNASSIGNED',
      modelId: model.id,
      customerId: null,
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Memory' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'MEM-32',
      specification: '32 GB',
    },
  })
  const secondDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'MEM-64',
      specification: '64 GB',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'R-A', rackName: 'Rack A' } })
  if (stock > 0) {
    const adjustment = await createStockAdjustmentIn(user.id, {
      transactionDate: '2026-07-18',
      customerId: null,
      details: [
        {
          deviceDetailId: detail.id.toString(),
          destinationRackId: rack.id.toString(),
          quantity: stock,
        },
      ],
    })
    await completeStockAdjustmentIn(adjustment.id, user.id)
  }

  return {
    admin,
    user,
    customer,
    otherCustomer,
    model,
    otherModel,
    serviceTag,
    unassignedServiceTag,
    device,
    detail,
    secondDetail,
    rack,
  }
}

function releaseInput(
  data: Awaited<ReturnType<typeof fixture>>,
  quantity = 3,
  overrides: Record<string, unknown> = {},
) {
  return {
    releaseDate: '2026-07-19',
    engineerName: 'Engineer One',
    customerId: data.customer.id.toString(),
    modelId: data.model.id.toString(),
    serviceTagId: data.serviceTag.id.toString(),
    referenceNumber: 'INC-123',
    notes: 'Customer support',
    details: [
      {
        deviceDetailId: data.detail.id.toString(),
        sourceRackId: data.rack.id.toString(),
        releasedQuantity: quantity,
        notes: 'Released line',
      },
    ],
    ...overrides,
  }
}

describe('stock release service', () => {
  it('creates SRL numbered drafts with displayed availability and no stock effect', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockRelease(data.user.id, releaseInput(data))

      expect(draft).toMatchObject({
        transactionNumber: 'SRL-202607-0001',
        status: TransactionStatus.DRAFT,
        engineerName: 'Engineer One',
        details: [{ releasedQuantity: 3, availableQuantity: 10 }],
      })
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(10)
      await expect(getStockRelease(draft.id)).resolves.toMatchObject({ id: draft.id })
      await expect(
        listStockReleases({
          search: 'Engineer One',
          status: 'DRAFT',
          customerId: data.customer.id.toString(),
          modelId: data.model.id.toString(),
          serviceTagId: data.serviceTag.id.toString(),
          dateFrom: '2026-07-19',
          dateTo: '2026-07-19',
        }),
      ).resolves.toMatchObject({ total: 1, data: [{ id: draft.id }] })
    })
  })

  it('requires Engineer and Customer before persisting a draft', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      await expect(
        createStockRelease(data.user.id, releaseInput(data, 1, { engineerName: '   ' })),
      ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' })
      const input = releaseInput(data)
      const { customerId: _, ...withoutCustomer } = input
      await expect(createStockRelease(data.user.id, withoutCustomer)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
      await expect(prisma.stockRelease.count()).resolves.toBe(0)
    })
  })

  it.each(['customer', 'model', 'serviceTag', 'deviceDetail', 'parentDevice', 'rack'] as const)(
    'rejects inactive %s assignments',
    async (master) => {
      await withCleanDatabase(async () => {
        const data = await fixture()
        if (master === 'customer') {
          await prisma.customer.update({
            where: { id: data.customer.id },
            data: { isActive: false },
          })
        } else if (master === 'model') {
          await prisma.model.update({ where: { id: data.model.id }, data: { isActive: false } })
        } else if (master === 'serviceTag') {
          await prisma.serviceTag.update({
            where: { id: data.serviceTag.id },
            data: { isActive: false },
          })
        } else if (master === 'deviceDetail') {
          await prisma.deviceDetail.update({
            where: { id: data.detail.id },
            data: { isActive: false },
          })
        } else if (master === 'parentDevice') {
          await prisma.device.update({ where: { id: data.device.id }, data: { isActive: false } })
        } else {
          await prisma.rack.update({ where: { id: data.rack.id }, data: { isActive: false } })
        }

        await expect(createStockRelease(data.user.id, releaseInput(data))).rejects.toMatchObject({
          statusCode: 422,
          code: 'INACTIVE_MASTER',
        })
      })
    },
  )

  it('enforces exact Service Tag Model and Customer relationships, including null Customer', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      for (const overrides of [
        { modelId: data.otherModel.id.toString() },
        { customerId: data.otherCustomer.id.toString() },
        { serviceTagId: data.unassignedServiceTag.id.toString() },
      ]) {
        await expect(
          createStockRelease(data.user.id, releaseInput(data, 1, overrides)),
        ).rejects.toMatchObject({
          statusCode: 422,
          code: 'SERVICE_TAG_MISMATCH',
        })
      }
    })
  })

  it('updates only drafts and revalidates active masters and current balance at completion', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture(5)
      const draft = await createStockRelease(data.user.id, releaseInput(data, 4))
      const competing = await createStockRelease(data.user.id, releaseInput(data, 2))
      await completeStockRelease(competing.id, data.user.id)

      await expect(completeStockRelease(draft.id, data.user.id)).rejects.toMatchObject({
        statusCode: 409,
        code: 'INSUFFICIENT_STOCK',
        message: expect.stringContaining('Available quantity: 3'),
      })
      expect((await getStockRelease(draft.id)).details[0]?.availableQuantity).toBe(3)

      const updated = await updateStockRelease(data.user.id, draft.id, releaseInput(data, 3))
      expect(updated.details[0]?.releasedQuantity).toBe(3)
      await completeStockRelease(draft.id, data.user.id)
      await expect(
        updateStockRelease(data.user.id, draft.id, releaseInput(data, 1)),
      ).rejects.toMatchObject({
        code: 'INVALID_TRANSACTION_STATE',
      })
    })
  })

  it('rejects completion atomically when a selected master is deactivated after drafting', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockRelease(data.user.id, releaseInput(data, 3))
      await prisma.rack.update({
        where: { id: data.rack.id },
        data: { isActive: false },
      })

      await expect(completeStockRelease(draft.id, data.user.id)).rejects.toMatchObject({
        statusCode: 422,
        code: 'INACTIVE_MASTER',
      })
      await expect(
        prisma.stockRelease.findUniqueOrThrow({ where: { id: BigInt(draft.id) } }),
      ).resolves.toMatchObject({ status: TransactionStatus.DRAFT })
      await expect(
        prisma.stockMovement.count({
          where: {
            transactionType: TransactionType.STOCK_RELEASE,
            transactionId: BigInt(draft.id),
          },
        }),
      ).resolves.toBe(0)
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(10)
    })
  })

  it('aggregates duplicate stock keys, prevents oversell, and is repeatedly idempotent', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture(5)
      const aggregateOversellInput = releaseInput(data, 3)
      aggregateOversellInput.details.push({
        deviceDetailId: data.detail.id.toString(),
        sourceRackId: data.rack.id.toString(),
        releasedQuantity: 3,
        notes: 'aggregate oversell',
      })
      const aggregateOversell = await createStockRelease(data.user.id, aggregateOversellInput)
      await expect(completeStockRelease(aggregateOversell.id, data.user.id)).rejects.toMatchObject({
        statusCode: 409,
        code: 'INSUFFICIENT_STOCK',
        message: expect.stringContaining('Available quantity: 5'),
        fieldErrors: {
          'details.0.releasedQuantity': [expect.stringContaining('Available quantity: 5')],
          'details.1.releasedQuantity': [expect.stringContaining('Available quantity: 5')],
        },
      })
      await expect(
        prisma.stockMovement.count({
          where: {
            transactionType: TransactionType.STOCK_RELEASE,
            transactionId: BigInt(aggregateOversell.id),
          },
        }),
      ).resolves.toBe(0)

      const input = releaseInput(data, 2)
      input.details.push({
        deviceDetailId: data.detail.id.toString(),
        sourceRackId: data.rack.id.toString(),
        releasedQuantity: 3,
        notes: 'duplicate',
      })
      const draft = await createStockRelease(data.user.id, input)
      expect(draft.details.map(({ availableQuantity }) => availableQuantity)).toEqual([5, 5])

      const completed = await completeStockRelease(draft.id, data.user.id)
      await expect(completeStockRelease(draft.id, data.user.id)).resolves.toMatchObject({
        status: TransactionStatus.COMPLETED,
      })
      expect(completed.details.map(({ availableQuantity }) => availableQuantity)).toEqual([0, 0])
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(0)
      await expect(
        prisma.stockMovement.count({
          where: {
            transactionType: TransactionType.STOCK_RELEASE,
            transactionId: BigInt(draft.id),
            movementPurpose: MovementPurpose.ORIGINAL,
          },
        }),
      ).resolves.toBe(2)

      const oversell = await createStockRelease(data.user.id, releaseInput(data, 1))
      await expect(completeStockRelease(oversell.id, data.user.id)).rejects.toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        message: expect.stringContaining('Available quantity: 0'),
      })
    })
  })

  it('supports the PostgreSQL Int maximum without numeric truncation', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture(POSTGRES_SIGNED_INTEGER_MAX)
      const draft = await createStockRelease(
        data.user.id,
        releaseInput(data, POSTGRES_SIGNED_INTEGER_MAX),
      )

      await expect(completeStockRelease(draft.id, data.user.id)).resolves.toMatchObject({
        status: TransactionStatus.COMPLETED,
        details: [{ releasedQuantity: POSTGRES_SIGNED_INTEGER_MAX }],
      })
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(0)
    })
  })

  it('cancels drafts without movements and completed releases with linked inbound reversals', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draftOnly = await createStockRelease(data.user.id, releaseInput(data, 1))
      await expect(cancelStockRelease(draftOnly.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })

      const posted = await createStockRelease(data.user.id, releaseInput(data, 3))
      await completeStockRelease(posted.id, data.user.id)
      await cancelStockRelease(posted.id, data.admin.id)
      await expect(cancelStockRelease(posted.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(10)
      const movements = await prisma.stockMovement.findMany({
        where: {
          transactionType: TransactionType.STOCK_RELEASE,
          transactionId: BigInt(posted.id),
        },
        orderBy: { id: 'asc' },
      })
      expect(movements).toHaveLength(2)
      expect(movements[1]).toMatchObject({
        movementPurpose: MovementPurpose.CANCELLATION_REVERSAL,
        reversalOfId: movements[0]!.id,
        quantityIn: 3,
        quantityOut: 0,
      })
    })
  })

  it('rejects cancellation and reports returnable details while a Completed Return exists', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const posted = await completeStockRelease(
        (await createStockRelease(data.user.id, releaseInput(data, 3))).id,
        data.user.id,
      )
      const returnable = await getStockReleaseReturnable(posted.id)
      expect(returnable).toMatchObject({
        id: posted.id,
        transactionNumber: posted.transactionNumber,
        engineerName: 'Engineer One',
        details: [
          {
            releasedQuantity: 3,
            completedReturnedQuantity: 0,
            remainingReturnableQuantity: 3,
          },
        ],
      })

      await prisma.stockReturn.create({
        data: {
          transactionNumber: 'SRT-202607-0001',
          returnDate: new Date('2026-07-20'),
          stockReleaseId: BigInt(posted.id),
          status: TransactionStatus.COMPLETED,
          createdById: data.user.id,
          details: {
            create: {
              stockReleaseDetailId: BigInt(posted.details[0]!.id),
              destinationRackId: data.rack.id,
              returnQuantity: 1,
            },
          },
        },
      })

      await expect(cancelStockRelease(posted.id, data.admin.id)).rejects.toMatchObject({
        statusCode: 409,
        code: 'COMPLETED_RETURN_EXISTS',
      })
      await expect(getStockReleaseReturnable(posted.id)).resolves.toMatchObject({
        details: [{ completedReturnedQuantity: 1, remainingReturnableQuantity: 2 }],
      })
      await prisma.stockReturn.updateMany({
        where: { stockReleaseId: BigInt(posted.id) },
        data: { status: TransactionStatus.CANCELLED },
      })
      await expect(cancelStockRelease(posted.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
