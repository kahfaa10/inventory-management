import { afterAll, describe, expect, it } from 'vitest'
import {
  MovementPurpose,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../../generated/prisma/client'
import { getStockBalance } from '../../server/services/stock.service'
import {
  MAX_TRANSACTION_SEQUENCE,
  nextTransactionNumber,
} from '../../server/services/transaction-number.service'
import { advisoryLockPair, lockStockKeys } from '../../server/utils/stock-lock'
import { runInventoryTransaction } from '../../server/utils/transaction'
import { prisma, withCleanDatabase } from '../helpers/database'

async function createStockFixture() {
  const user = await prisma.user.create({
    data: {
      email: 'stock-service@example.com',
      displayName: 'Stock Service',
      passwordHash: 'not-used',
      role: UserRole.ADMIN,
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Hard Disk' } })
  const deviceDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: '0B24496',
      dpn: '0B24496',
      specification: '600 GB 15K 3.5-inch 6G SAS',
    },
  })
  const otherDetail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'OTHER',
      specification: 'Other disk',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'A', rackName: 'Rack A' } })
  const otherRack = await prisma.rack.create({
    data: { rackCode: 'B', rackName: 'Rack B' },
  })
  const adjustment = await prisma.stockAdjustmentIn.create({
    data: {
      transactionNumber: 'SAI-202607-9000',
      transactionDate: new Date('2026-07-19'),
      status: TransactionStatus.COMPLETED,
      createdById: user.id,
      details: {
        create: [
          { deviceDetailId: deviceDetail.id, rackId: rack.id, quantity: 10 },
          { deviceDetailId: deviceDetail.id, rackId: rack.id, quantity: 3 },
          { deviceDetailId: deviceDetail.id, rackId: rack.id, quantity: 1 },
          { deviceDetailId: deviceDetail.id, rackId: otherRack.id, quantity: 99 },
          { deviceDetailId: otherDetail.id, rackId: rack.id, quantity: 99 },
        ],
      },
    },
    include: { details: true },
  })

  return { user, deviceDetail, otherDetail, rack, otherRack, adjustment }
}

describe('stock and transaction infrastructure', () => {
  it('sums ledger movements by the exact Device Detail and Rack pair', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createStockFixture()
      const [stockIn, stockOut, stockReturn, otherRack, otherDetail] = fixture.adjustment.details

      await prisma.stockMovement.createMany({
        data: [
          {
            deviceDetailId: fixture.deviceDetail.id,
            rackId: fixture.rack.id,
            transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
            transactionId: fixture.adjustment.id,
            transactionDetailId: stockIn!.id,
            transactionNumber: 'SAI-202607-9000',
            transactionDate: new Date('2026-07-19'),
            quantityIn: 10,
            quantityOut: 0,
            movementPurpose: MovementPurpose.ORIGINAL,
            createdById: fixture.user.id,
          },
          {
            deviceDetailId: fixture.deviceDetail.id,
            rackId: fixture.rack.id,
            transactionType: TransactionType.STOCK_RELEASE,
            transactionId: fixture.adjustment.id,
            transactionDetailId: stockOut!.id,
            transactionNumber: 'SRL-202607-9000',
            transactionDate: new Date('2026-07-20'),
            quantityIn: 0,
            quantityOut: 3,
            movementPurpose: MovementPurpose.ORIGINAL,
            createdById: fixture.user.id,
          },
          {
            deviceDetailId: fixture.deviceDetail.id,
            rackId: fixture.rack.id,
            transactionType: TransactionType.STOCK_RETURN,
            transactionId: fixture.adjustment.id,
            transactionDetailId: stockReturn!.id,
            transactionNumber: 'SRT-202607-9000',
            transactionDate: new Date('2026-07-21'),
            quantityIn: 1,
            quantityOut: 0,
            movementPurpose: MovementPurpose.ORIGINAL,
            createdById: fixture.user.id,
          },
          {
            deviceDetailId: fixture.deviceDetail.id,
            rackId: fixture.otherRack.id,
            transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
            transactionId: fixture.adjustment.id,
            transactionDetailId: otherRack!.id,
            transactionNumber: 'SAI-202607-9001',
            transactionDate: new Date('2026-07-19'),
            quantityIn: 99,
            quantityOut: 0,
            movementPurpose: MovementPurpose.ORIGINAL,
            createdById: fixture.user.id,
          },
          {
            deviceDetailId: fixture.otherDetail.id,
            rackId: fixture.rack.id,
            transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
            transactionId: fixture.adjustment.id,
            transactionDetailId: otherDetail!.id,
            transactionNumber: 'SAI-202607-9002',
            transactionDate: new Date('2026-07-19'),
            quantityIn: 99,
            quantityOut: 0,
            movementPurpose: MovementPurpose.ORIGINAL,
            createdById: fixture.user.id,
          },
        ],
      })

      await expect(getStockBalance(prisma, fixture.deviceDetail.id, fixture.rack.id)).resolves.toBe(
        8,
      )
    })
  })

  it('nets an original movement and its valid cancellation reversal to zero', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createStockFixture()
      const detail = fixture.adjustment.details[0]!
      const original = await prisma.stockMovement.create({
        data: {
          deviceDetailId: fixture.deviceDetail.id,
          rackId: fixture.rack.id,
          transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
          transactionId: fixture.adjustment.id,
          transactionDetailId: detail.id,
          transactionNumber: fixture.adjustment.transactionNumber,
          transactionDate: fixture.adjustment.transactionDate,
          quantityIn: 10,
          quantityOut: 0,
          movementPurpose: MovementPurpose.ORIGINAL,
          createdById: fixture.user.id,
        },
      })
      await prisma.stockMovement.create({
        data: {
          deviceDetailId: original.deviceDetailId,
          rackId: original.rackId,
          transactionType: original.transactionType,
          transactionId: original.transactionId,
          transactionDetailId: original.transactionDetailId,
          transactionNumber: original.transactionNumber,
          transactionDate: original.transactionDate,
          quantityIn: 0,
          quantityOut: original.quantityIn,
          movementPurpose: MovementPurpose.CANCELLATION_REVERSAL,
          reversalOfId: original.id,
          createdById: fixture.user.id,
        },
      })

      await expect(getStockBalance(prisma, fixture.deviceDetail.id, fixture.rack.id)).resolves.toBe(
        0,
      )
    })
  })

  it('allocates genuine concurrent transaction numbers atomically and sequentially', async () => {
    await withCleanDatabase(async () => {
      const date = new Date('2026-07-19')
      const numbers = await Promise.all([
        runInventoryTransaction((tx) =>
          nextTransactionNumber(tx, TransactionType.STOCK_ADJUSTMENT_IN, date),
        ),
        runInventoryTransaction((tx) =>
          nextTransactionNumber(tx, TransactionType.STOCK_ADJUSTMENT_IN, date),
        ),
      ])

      expect(numbers.sort()).toEqual(['SAI-202607-0001', 'SAI-202607-0002'])
      await expect(
        prisma.transactionCounter.findUniqueOrThrow({
          where: {
            transactionType_yearMonth: {
              transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
              yearMonth: '202607',
            },
          },
        }),
      ).resolves.toMatchObject({ lastNumber: 2 })
    })
  })

  it('allocates the last PostgreSQL Int sequence and then reports stable exhaustion', async () => {
    await withCleanDatabase(async () => {
      await prisma.transactionCounter.create({
        data: {
          transactionType: TransactionType.STOCK_RELEASE,
          yearMonth: '202607',
          lastNumber: MAX_TRANSACTION_SEQUENCE - 1,
        },
      })

      await expect(
        runInventoryTransaction((tx) =>
          nextTransactionNumber(tx, TransactionType.STOCK_RELEASE, new Date('2026-07-19')),
        ),
      ).resolves.toBe(`SRL-202607-${MAX_TRANSACTION_SEQUENCE}`)
      await expect(
        runInventoryTransaction((tx) =>
          nextTransactionNumber(tx, TransactionType.STOCK_RELEASE, new Date('2026-07-19')),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'TRANSACTION_NUMBER_EXHAUSTED',
      })
    })
  })

  it('holds the exact advisory lock in its transaction and releases it on commit', async () => {
    await withCleanDatabase(async () => {
      const fixture = await createStockFixture()
      const key = { deviceDetailId: fixture.deviceDetail.id, rackId: fixture.rack.id }
      const [deviceKey, rackKey] = advisoryLockPair(key)
      let signalAcquired!: () => void
      let releaseLock!: () => void
      const acquired = new Promise<void>((resolve) => {
        signalAcquired = resolve
      })
      const release = new Promise<void>((resolve) => {
        releaseLock = resolve
      })

      const holder = runInventoryTransaction(async (tx) => {
        await lockStockKeys(tx, [key])
        signalAcquired()
        await release
      })
      await acquired

      const lockedWhileHeld = await prisma.$transaction(async (tx) => {
        const [result] = await tx.$queryRaw<{ acquired: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${deviceKey}, ${rackKey}) AS acquired`,
        )
        return result!.acquired
      })
      expect(lockedWhileHeld).toBe(false)

      releaseLock()
      await holder

      const lockedAfterCommit = await prisma.$transaction(async (tx) => {
        const [result] = await tx.$queryRaw<{ acquired: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${deviceKey}, ${rackKey}) AS acquired`,
        )
        return result!.acquired
      })
      expect(lockedAfterCommit).toBe(true)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
