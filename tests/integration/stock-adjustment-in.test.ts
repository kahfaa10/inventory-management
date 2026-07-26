import { afterAll, describe, expect, it } from 'vitest'
import { MovementPurpose, TransactionStatus, UserRole } from '../../generated/prisma/client'
import {
  cancelStockAdjustmentIn,
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
  getStockAdjustmentIn,
  listStockAdjustmentIns,
  updateStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import { getStockBalance } from '../../server/services/stock.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function fixture() {
  const admin = await prisma.user.create({
    data: {
      email: 'adjustment-admin@example.com',
      displayName: 'Adjustment Admin',
      passwordHash: 'unused',
      role: UserRole.ADMIN,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: 'adjustment-user@example.com',
      displayName: 'Adjustment User',
      passwordHash: 'unused',
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Acme Support' } })
  const device = await prisma.device.create({ data: { deviceName: 'Hard Disk' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: '0B24496',
      specification: '600 GB SAS',
    },
  })
  const secondDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: '0B24497',
      specification: '900 GB SAS',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'A', rackName: 'Rack A' } })
  return { admin, user, customer, device, detail, secondDetail, rack }
}

function draftInput(ids: { customer?: bigint; detail: bigint; rack: bigint; quantity?: number }) {
  return {
    transactionDate: '2026-07-19',
    customerId: ids.customer?.toString() ?? null,
    notes: 'Initial stock',
    details: [
      {
        deviceDetailId: ids.detail.toString(),
        destinationRackId: ids.rack.toString(),
        quantity: ids.quantity ?? 10,
        notes: 'Line note',
      },
    ],
  }
}

describe('stock adjustment in service', () => {
  it('creates a numbered draft atomically without affecting stock and supports read filters', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockAdjustmentIn(
        data.user.id,
        draftInput({
          customer: data.customer.id,
          detail: data.detail.id,
          rack: data.rack.id,
        }),
      )

      expect(draft).toMatchObject({
        transactionNumber: 'SAI-202607-0001',
        status: TransactionStatus.DRAFT,
        notes: 'Initial stock',
      })
      expect(draft.details[0]).toMatchObject({
        destinationRackId: data.rack.id.toString(),
        quantity: 10,
      })
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(0)
      await expect(
        listStockAdjustmentIns({ search: '0001', status: 'DRAFT', dateFrom: '2026-07-19' }),
      ).resolves.toMatchObject({ total: 1, data: [{ id: draft.id }] })
      await expect(getStockAdjustmentIn(draft.id)).resolves.toMatchObject({ id: draft.id })
    })
  })

  it.each(['customer', 'deviceDetail', 'parentDevice', 'rack'] as const)(
    'rejects inactive %s assignments',
    async (master) => {
      await withCleanDatabase(async () => {
        const data = await fixture()
        if (master === 'customer') {
          await prisma.customer.update({
            where: { id: data.customer.id },
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

        await expect(
          createStockAdjustmentIn(
            data.user.id,
            draftInput({
              customer: data.customer.id,
              detail: data.detail.id,
              rack: data.rack.id,
            }),
          ),
        ).rejects.toMatchObject({ statusCode: 422, code: 'INACTIVE_MASTER' })
      })
    },
  )

  it('replaces draft content atomically and keeps terminal content immutable', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockAdjustmentIn(
        data.user.id,
        draftInput({ detail: data.detail.id, rack: data.rack.id }),
      )
      const updated = await updateStockAdjustmentIn(data.user.id, draft.id, {
        ...draftInput({ detail: data.secondDetail.id, rack: data.rack.id, quantity: 4 }),
        notes: '',
      })
      expect(updated).toMatchObject({ notes: null, details: [{ quantity: 4 }] })
      expect(updated.details[0]?.deviceDetailId).toBe(data.secondDetail.id.toString())

      await completeStockAdjustmentIn(draft.id, data.user.id)
      await expect(
        updateStockAdjustmentIn(
          data.user.id,
          draft.id,
          draftInput({ detail: data.detail.id, rack: data.rack.id }),
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSACTION_STATE' })
    })
  })

  it('posts one original movement per detail, aggregates duplicate locks, and is idempotent', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const input = draftInput({ detail: data.detail.id, rack: data.rack.id, quantity: 6 })
      input.details.push({
        deviceDetailId: data.detail.id.toString(),
        destinationRackId: data.rack.id.toString(),
        quantity: 4,
        notes: 'duplicate key',
      })
      const draft = await createStockAdjustmentIn(data.user.id, input)

      const results = await Promise.all([
        completeStockAdjustmentIn(draft.id, data.user.id),
        completeStockAdjustmentIn(draft.id, data.user.id),
      ])
      expect(results.every((result) => result.status === TransactionStatus.COMPLETED)).toBe(true)
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(10)
      await expect(
        prisma.stockMovement.count({
          where: { transactionId: BigInt(draft.id), movementPurpose: MovementPurpose.ORIGINAL },
        }),
      ).resolves.toBe(2)
    })
  })

  it('rolls back status and all movements when one line becomes invalid before completion', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const input = draftInput({ detail: data.detail.id, rack: data.rack.id })
      input.details.push({
        deviceDetailId: data.secondDetail.id.toString(),
        destinationRackId: data.rack.id.toString(),
        quantity: 2,
        notes: 'later inactive',
      })
      const draft = await createStockAdjustmentIn(data.user.id, input)
      await prisma.deviceDetail.update({
        where: { id: data.secondDetail.id },
        data: { isActive: false },
      })

      await expect(completeStockAdjustmentIn(draft.id, data.user.id)).rejects.toMatchObject({
        code: 'INACTIVE_MASTER',
      })
      await expect(
        prisma.stockAdjustmentIn.findUniqueOrThrow({ where: { id: BigInt(draft.id) } }),
      ).resolves.toMatchObject({ status: TransactionStatus.DRAFT })
      await expect(
        prisma.stockMovement.count({ where: { transactionId: BigInt(draft.id) } }),
      ).resolves.toBe(0)
    })
  })

  it('cancels drafts without movements and completed adjustments with one linked reversal each', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draftOnly = await createStockAdjustmentIn(
        data.user.id,
        draftInput({ detail: data.secondDetail.id, rack: data.rack.id }),
      )
      await expect(cancelStockAdjustmentIn(draftOnly.id, data.admin.id)).resolves.toMatchObject({
        status: TransactionStatus.CANCELLED,
      })
      await expect(
        prisma.stockMovement.count({ where: { transactionId: BigInt(draftOnly.id) } }),
      ).resolves.toBe(0)

      const posted = await createStockAdjustmentIn(
        data.user.id,
        draftInput({ detail: data.detail.id, rack: data.rack.id }),
      )
      await completeStockAdjustmentIn(posted.id, data.user.id)
      const firstCancel = await cancelStockAdjustmentIn(posted.id, data.admin.id)
      const secondCancel = await cancelStockAdjustmentIn(posted.id, data.admin.id)
      expect(firstCancel.status).toBe(TransactionStatus.CANCELLED)
      expect(secondCancel.status).toBe(TransactionStatus.CANCELLED)
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(0)
      const movements = await prisma.stockMovement.findMany({
        where: { transactionId: BigInt(posted.id) },
        orderBy: { id: 'asc' },
      })
      expect(movements).toHaveLength(2)
      expect(movements[1]).toMatchObject({
        movementPurpose: MovementPurpose.CANCELLATION_REVERSAL,
        reversalOfId: movements[0]!.id,
        quantityIn: 0,
        quantityOut: 10,
        createdById: data.admin.id,
      })
    })
  })

  it('blocks cancellation when later stock-out makes the reversal unavailable', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const draft = await createStockAdjustmentIn(
        data.user.id,
        draftInput({ detail: data.detail.id, rack: data.rack.id }),
      )
      await completeStockAdjustmentIn(draft.id, data.user.id)
      const sourceDetail = await prisma.stockAdjustmentInDetail.findFirstOrThrow({
        where: { stockAdjustmentInId: BigInt(draft.id) },
      })
      await prisma.stockMovement.create({
        data: {
          deviceDetailId: data.detail.id,
          rackId: data.rack.id,
          transactionType: 'STOCK_RELEASE',
          transactionId: BigInt(999),
          transactionDetailId: sourceDetail.id + BigInt(999),
          transactionNumber: 'SRL-202607-9999',
          transactionDate: new Date('2026-07-20'),
          quantityIn: 0,
          quantityOut: 1,
          createdById: data.user.id,
        },
      })

      await expect(cancelStockAdjustmentIn(draft.id, data.admin.id)).rejects.toMatchObject({
        statusCode: 409,
        code: 'INSUFFICIENT_STOCK_FOR_CANCELLATION',
      })
      await expect(getStockBalance(prisma, data.detail.id, data.rack.id)).resolves.toBe(9)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
