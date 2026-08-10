import { beforeAll, describe, expect, it } from 'vitest'
import { MovementPurpose, TransactionType, UserRole } from '../../generated/prisma/client'
import {
  cancelStockAdjustmentIn,
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import {
  cancelStockRelease,
  completeStockRelease,
  createStockRelease,
} from '../../server/services/stock-release.service'
import {
  cancelStockReturn,
  completeStockReturn,
  createStockReturn,
} from '../../server/services/stock-return.service'
import {
  getStockCardByCustomerReport,
  getStockCardReport,
  getStockInByCustomerReport,
  getStockInReport,
  getStockOutByCustomerReport,
  getStockOutReport,
} from '../../server/services/report.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function createFixture() {
  const user = await prisma.user.create({
    data: {
      email: 'reports@example.com',
      displayName: 'Report User',
      passwordHash: 'not-used',
      role: UserRole.USER,
    },
  })
  const otherCustomer = await prisma.customer.create({
    data: { customerName: 'Other Customer' },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Report Customer' } })
  const model = await prisma.model.create({ data: { modelName: 'PowerEdge Report' } })
  const tag = await prisma.serviceTag.create({
    data: {
      modelId: model.id,
      customerId: customer.id,
      serviceTag: 'REPORT-TAG',
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Hard Disk' } })
  const detail = await prisma.deviceDetail.create({
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
      partNumber: 'OTHER-PN',
      specification: 'Other part',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'RACK-A', rackName: 'Rack A' } })
  const otherRack = await prisma.rack.create({
    data: { rackCode: 'RACK-B', rackName: 'Rack B' },
  })

  const adjustment = await completeStockAdjustmentIn(
    (
      await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-01',
        customerId: customer.id.toString(),
        notes: 'Opening stock',
        details: [
          {
            deviceDetailId: detail.id.toString(),
            destinationRackId: rack.id.toString(),
            quantity: 10,
            notes: 'Ten received',
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
        engineerName: 'Engineer One',
        customerId: customer.id.toString(),
        modelId: model.id.toString(),
        serviceTagId: tag.id.toString(),
        referenceNumber: 'TICKET-001',
        notes: 'Customer job',
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: rack.id.toString(),
            releasedQuantity: 3,
            notes: 'Three released',
          },
        ],
      })
    ).id,
    user.id,
  )
  const returned = await completeStockReturn(
    (
      await createStockReturn(user.id, {
        returnDate: '2026-07-03',
        stockReleaseId: release.id,
        notes: 'One returned',
        details: [
          {
            stockReleaseDetailId: release.details[0]!.id,
            destinationRackId: rack.id.toString(),
            returnQuantity: 1,
            notes: 'Return line',
          },
        ],
      })
    ).id,
    user.id,
  )

  await createStockAdjustmentIn(user.id, {
    transactionDate: '2026-07-04',
    customerId: customer.id.toString(),
    details: [
      {
        deviceDetailId: detail.id.toString(),
        destinationRackId: rack.id.toString(),
        quantity: 100,
      },
    ],
  })
  await completeStockAdjustmentIn(
    (
      await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-04',
        customerId: otherCustomer.id.toString(),
        details: [
          {
            deviceDetailId: otherDetail.id.toString(),
            destinationRackId: otherRack.id.toString(),
            quantity: 4,
          },
        ],
      })
    ).id,
    user.id,
  )

  return {
    user,
    customer,
    otherCustomer,
    model,
    tag,
    device,
    detail,
    otherDetail,
    rack,
    otherRack,
    adjustment,
    release,
    returned,
  }
}

beforeAll(async () => {
  await prisma.$connect()
})

describe('ledger-backed inventory reports', () => {
  it('verifies the 10 - 3 + 1 sample and excludes drafts', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()

      const stockCard = await getStockCardReport({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
      })
      expect(
        stockCard.rows.map((row) => [row.quantityIn, row.quantityOut, row.runningBalance]),
      ).toEqual([
        [10, 0, 10],
        [0, 3, 7],
        [1, 0, 8],
      ])

      const stockIn = await getStockInReport({ deviceId: data.device.id.toString() })
      expect(stockIn.rows.map((row) => row.stockInType)).toEqual([
        'Adjustment In',
        'Return',
        'Adjustment In',
      ])
      expect(stockIn.rows.every((row) => row.quantity !== 100)).toBe(true)

      const stockOut = await getStockOutReport()
      expect(stockOut.rows).toHaveLength(1)
      expect(stockOut.rows[0]).toMatchObject({
        releasedQuantity: 3,
        supportReference: 'TICKET-001',
      })
    })
  })

  it('carries pre-range movements into the opening running balance', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()
      const report = await getStockCardReport({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
        dateFrom: '2026-07-02',
        dateTo: '2026-07-03',
      })

      expect(report.rows.map((row) => [row.transactionDate, row.runningBalance])).toEqual([
        ['2026-07-02', 7],
        ['2026-07-03', 8],
      ])
    })
  })

  it('shows cancellation reversals in Stock Card but excludes cancelled headers from flow reports', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()
      await (
        await import('../../server/services/stock-return.service')
      ).cancelStockReturn(data.returned.id, data.user.id)

      const card = await getStockCardReport({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
      })
      expect(card.rows.map((row) => row.movementPurpose)).toEqual([
        'ORIGINAL',
        'ORIGINAL',
        'ORIGINAL',
        'CANCELLATION_REVERSAL',
      ])
      expect(card.rows.at(-1)?.runningBalance).toBe(7)

      const stockIn = await getStockInReport({
        deviceDetailId: data.detail.id.toString(),
      })
      expect(stockIn.rows.map((row) => row.stockInType)).toEqual(['Adjustment In'])
    })
  })

  it('keeps all cancellation reversals in Stock Card while excluding every cancelled flow header', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()
      await cancelStockReturn(data.returned.id, data.user.id)
      await cancelStockRelease(data.release.id, data.user.id)
      await cancelStockAdjustmentIn(data.adjustment.id, data.user.id)

      const filters = {
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
      }
      const card = await getStockCardReport(filters)
      expect(card.rows).toHaveLength(6)
      expect(
        card.rows.filter((row) => row.movementPurpose === 'CANCELLATION_REVERSAL'),
      ).toHaveLength(3)
      expect(card.rows.at(-1)?.runningBalance).toBe(0)
      await expect(getStockInReport(filters)).resolves.toMatchObject({ total: 0, rows: [] })
      await expect(getStockOutReport(filters)).resolves.toMatchObject({ total: 0, rows: [] })
    })
  })

  it('strictly isolates customer variants and applies all report filters', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()
      const customerId = data.customer.id.toString()

      const card = await getStockCardByCustomerReport({
        customerId,
        modelId: data.model.id.toString(),
        serviceTagId: data.tag.id.toString(),
        deviceId: data.device.id.toString(),
        deviceDetailId: data.detail.id.toString(),
        partNumber: '0b244',
        transactionType: 'STOCK_RELEASE',
      })
      expect(card.rows).toHaveLength(1)
      expect(card.rows.every((row) => row.customerId === customerId)).toBe(true)

      const stockIn = await getStockInByCustomerReport({
        customerId,
        deviceId: data.device.id.toString(),
        deviceDetailId: data.detail.id.toString(),
        partNumber: '0B244',
        dpn: '0b244',
        rackId: data.rack.id.toString(),
        stockInType: 'RETURN',
      })
      expect(stockIn.rows).toHaveLength(1)
      expect(stockIn.rows[0]?.customerId).toBe(customerId)

      const stockOut = await getStockOutByCustomerReport({
        customerId,
        engineerName: 'engineer',
        modelId: data.model.id.toString(),
        serviceTagId: data.tag.id.toString(),
        deviceId: data.device.id.toString(),
        deviceDetailId: data.detail.id.toString(),
        partNumber: '0B244',
        dpn: '0b244',
        rackId: data.rack.id.toString(),
      })
      expect(stockOut.rows).toHaveLength(1)
      expect(stockOut.rows[0]?.customerId).toBe(customerId)

      const nonMatchingStockOutFilters = [
        { dateFrom: '2026-07-03' },
        { dateTo: '2026-07-01' },
        { customerId: data.otherCustomer.id.toString() },
        { engineerName: 'does-not-match' },
        { modelId: '999999' },
        { serviceTagId: '999999' },
        { deviceId: '999999' },
        { deviceDetailId: data.otherDetail.id.toString() },
        { partNumber: 'does-not-match' },
        { dpn: 'does-not-match' },
        { rackId: data.otherRack.id.toString() },
      ]
      for (const mismatch of nonMatchingStockOutFilters) {
        await expect(
          getStockOutReport({
            customerId,
            ...mismatch,
          }),
        ).resolves.toMatchObject({ total: 0, rows: [] })
      }
    })
  })

  it('paginates in stable chronological order and returns normalized filters', async () => {
    await withCleanDatabase(async () => {
      const data = await createFixture()
      const tiedTimestamp = new Date('2026-07-05T00:00:00.000Z')
      await prisma.stockMovement.createMany({
        data: ['SAI-TIE-0002', 'SAI-TIE-0001'].map((transactionNumber, index) => ({
          transactionType: TransactionType.STOCK_ADJUSTMENT_IN,
          transactionId: BigInt(90_000 + index),
          transactionDetailId: BigInt(90_000 + index),
          transactionNumber,
          transactionDate: tiedTimestamp,
          deviceDetailId: data.detail.id,
          rackId: data.rack.id,
          quantityIn: 1,
          quantityOut: 0,
          movementPurpose: MovementPurpose.ORIGINAL,
          createdById: data.user.id,
          createdAt: tiedTimestamp,
        })),
      })
      const pageOne = await getStockCardReport({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
        page: 1,
        pageSize: 4,
      })
      const pageTwo = await getStockCardReport({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
        page: 2,
        pageSize: 4,
      })

      expect(pageOne.total).toBe(5)
      expect(pageOne.rows).toHaveLength(4)
      expect(pageTwo.rows).toHaveLength(1)
      expect([...pageOne.rows, ...pageTwo.rows].map((row) => row.transactionNumber)).toEqual([
        data.adjustment.transactionNumber,
        data.release.transactionNumber,
        data.returned.transactionNumber,
        'SAI-TIE-0001',
        'SAI-TIE-0002',
      ])
      expect(pageOne.filters).toMatchObject({
        deviceDetailId: data.detail.id.toString(),
        rackId: data.rack.id.toString(),
        page: 1,
        pageSize: 4,
      })
    })
  })

  it('rejects missing customer filters and unknown query keys', async () => {
    await expect(getStockCardByCustomerReport({})).rejects.toMatchObject({
      statusCode: 422,
    })
    await expect(
      getStockInReport({ stockInType: 'STOCK_ADJUSTMENT_IN', injected: 'x' }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})
