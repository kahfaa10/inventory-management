import { describe, expect, it } from 'vitest'
import { prisma, withCleanDatabase } from '../helpers/database'

async function createMovementFixture() {
  const user = await prisma.user.create({
    data: {
      email: 'ledger@example.com',
      displayName: 'Ledger Tester',
      passwordHash: 'not-used-by-schema-tests',
    },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Disk' } })
  const deviceDetail = await prisma.deviceDetail.create({
    data: { deviceId: device.id, partNumber: 'PN-LEDGER', specification: '600GB' },
  })
  const rack = await prisma.rack.create({
    data: { rackCode: 'R-LEDGER', rackName: 'Ledger Rack' },
  })
  const otherRack = await prisma.rack.create({
    data: { rackCode: 'R-OTHER', rackName: 'Other Rack' },
  })

  return { user, deviceDetail, rack, otherRack }
}

describe('inventory schema', () => {
  it('rejects duplicate null-DPN details within the same device', async () => {
    await withCleanDatabase(async () => {
      const device = await prisma.device.create({ data: { deviceName: 'Disk' } })
      await prisma.deviceDetail.create({
        data: { deviceId: device.id, partNumber: 'PN-1', specification: '600GB' },
      })
      await expect(
        prisma.deviceDetail.create({
          data: { deviceId: device.id, partNumber: 'PN-1', specification: 'Other' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })
  })

  it('exposes the ERD field contracts through Prisma', async () => {
    await withCleanDatabase(async () => {
      const customer = await prisma.customer.create({
        data: {
          customerName: 'ACME',
          contactPerson: 'Ari',
          contactNumber: '+62 21 555 0100',
        },
      })
      const user = await prisma.user.create({
        data: {
          email: 'schema@example.com',
          displayName: 'Schema Tester',
          passwordHash: 'not-used-by-schema-tests',
        },
      })
      const device = await prisma.device.create({ data: { deviceName: 'Memory' } })
      const deviceDetail = await prisma.deviceDetail.create({
        data: { deviceId: device.id, partNumber: 'PN-SCHEMA', specification: '32GB' },
      })
      const rack = await prisma.rack.create({
        data: { rackCode: 'R-SCHEMA', rackName: 'Schema Rack' },
      })
      const adjustment = await prisma.stockAdjustmentIn.create({
        data: {
          transactionNumber: 'SAI-202607-0001',
          transactionDate: new Date('2026-07-26'),
          customerId: customer.id,
          createdById: user.id,
          details: {
            create: {
              deviceDetailId: deviceDetail.id,
              rackId: rack.id,
              quantity: 1,
              notes: 'ERD detail notes',
            },
          },
        },
        include: { details: true },
      })
      const release = await prisma.stockRelease.create({
        data: {
          transactionNumber: 'SRL-202607-0001',
          releaseDate: new Date('2026-07-26'),
          engineerName: 'Engineer One',
          customerId: customer.id,
          createdById: user.id,
          details: {
            create: {
              deviceDetailId: deviceDetail.id,
              rackId: rack.id,
              releasedQuantity: 1,
              notes: 'Release detail notes',
            },
          },
        },
        include: { details: true },
      })
      const stockReturn = await prisma.stockReturn.create({
        data: {
          transactionNumber: 'SRT-202607-0001',
          returnDate: new Date('2026-07-26'),
          stockReleaseId: release.id,
          createdById: user.id,
          details: {
            create: {
              stockReleaseDetailId: release.details[0]!.id,
              destinationRackId: rack.id,
              returnQuantity: 1,
              notes: 'Return detail notes',
            },
          },
        },
        include: { details: { include: { destinationRack: true } } },
      })
      const movement = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          customerId: customer.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: adjustment.id,
          transactionDetailId: adjustment.details[0]!.id,
          transactionNumber: adjustment.transactionNumber,
          transactionDate: adjustment.transactionDate,
          engineerName: null,
          quantityIn: 1,
          createdById: user.id,
        },
      })

      expect(customer).toMatchObject({ contactPerson: 'Ari', contactNumber: '+62 21 555 0100' })
      expect(customer).not.toHaveProperty('contactEmail')
      expect(adjustment.details[0]).toMatchObject({ notes: 'ERD detail notes' })
      expect(release.details[0]).toMatchObject({ notes: 'Release detail notes' })
      expect(stockReturn.details[0]).toMatchObject({
        destinationRackId: rack.id,
        notes: 'Return detail notes',
        destinationRack: { id: rack.id },
      })
      expect(movement).toMatchObject({ transactionId: adjustment.id, engineerName: null })
    })
  })

  it('enforces reversal purpose, target, source, and opposite-quantity invariants', async () => {
    await withCleanDatabase(async () => {
      const { user, deviceDetail, rack, otherRack } = await createMovementFixture()
      const original = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: 11n,
          transactionDetailId: 12n,
          transactionNumber: 'SAI-202607-0011',
          transactionDate: new Date('2026-07-26'),
          quantityIn: 5,
          createdById: user.id,
        },
      })

      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: rack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 21n,
            transactionDetailId: 22n,
            transactionNumber: 'SAI-202607-0021',
            transactionDate: new Date('2026-07-26'),
            quantityIn: 1,
            movementPurpose: 'ORIGINAL',
            reversalOfId: original.id,
            createdById: user.id,
          },
        }),
      ).rejects.toThrow()

      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: rack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 11n,
            transactionDetailId: 12n,
            transactionNumber: 'SAI-202607-0011',
            transactionDate: new Date('2026-07-26'),
            quantityOut: 5,
            movementPurpose: 'CANCELLATION_REVERSAL',
            createdById: user.id,
          },
        }),
      ).rejects.toThrow()

      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: rack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 11n,
            transactionDetailId: 12n,
            transactionNumber: 'SAI-202607-0011',
            transactionDate: new Date('2026-07-26'),
            quantityOut: 4,
            movementPurpose: 'CANCELLATION_REVERSAL',
            reversalOfId: original.id,
            createdById: user.id,
          },
        }),
      ).rejects.toThrow()

      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: otherRack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 11n,
            transactionDetailId: 12n,
            transactionNumber: 'SAI-202607-0011',
            transactionDate: new Date('2026-07-26'),
            quantityOut: 5,
            movementPurpose: 'CANCELLATION_REVERSAL',
            reversalOfId: original.id,
            createdById: user.id,
          },
        }),
      ).rejects.toThrow()

      const reversal = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: 11n,
          transactionDetailId: 12n,
          transactionNumber: 'SAI-202607-0011',
          transactionDate: new Date('2026-07-26'),
          quantityOut: 5,
          movementPurpose: 'CANCELLATION_REVERSAL',
          reversalOfId: original.id,
          createdById: user.id,
        },
      })

      expect(reversal.reversalOfId).toBe(original.id)
      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: rack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 11n,
            transactionDetailId: 12n,
            transactionNumber: 'SAI-202607-0011',
            transactionDate: new Date('2026-07-26'),
            quantityOut: 5,
            movementPurpose: 'CANCELLATION_REVERSAL',
            reversalOfId: original.id,
            createdById: user.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })

      await expect(
        prisma.$queryRaw<Array<{ indexdef: string }>>`
          SELECT indexdef
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'stock_movements'
            AND indexname = 'stock_movements_one_reversal_per_original_key'
        `,
      ).resolves.toEqual([
        {
          indexdef: expect.stringMatching(
            /CREATE UNIQUE INDEX .* ON .*stock_movements.*reversal_of_id.*WHERE.*reversal_of_id.*IS NOT NULL/i,
          ),
        },
      ])
    })
  })

  it('rejects reversals of non-original movements', async () => {
    await withCleanDatabase(async () => {
      const { user, deviceDetail, rack } = await createMovementFixture()
      const original = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: 31n,
          transactionDetailId: 32n,
          transactionNumber: 'SAI-202607-0031',
          transactionDate: new Date('2026-07-26'),
          quantityIn: 2,
          createdById: user.id,
        },
      })
      const reversal = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: 31n,
          transactionDetailId: 32n,
          transactionNumber: 'SAI-202607-0031',
          transactionDate: new Date('2026-07-26'),
          quantityOut: 2,
          movementPurpose: 'CANCELLATION_REVERSAL',
          reversalOfId: original.id,
          createdById: user.id,
        },
      })

      await expect(
        prisma.stockMovement.create({
          data: {
            deviceDetailId: deviceDetail.id,
            rackId: rack.id,
            transactionType: 'STOCK_ADJUSTMENT_IN',
            transactionId: 41n,
            transactionDetailId: 42n,
            transactionNumber: 'SAI-202607-0041',
            transactionDate: new Date('2026-07-26'),
            quantityIn: 2,
            movementPurpose: 'CANCELLATION_REVERSAL',
            reversalOfId: reversal.id,
            createdById: user.id,
          },
        }),
      ).rejects.toThrow()
    })
  })

  it('rejects ordinary updates and deletes of ledger rows', async () => {
    await withCleanDatabase(async () => {
      const { user, deviceDetail, rack } = await createMovementFixture()
      const original = await prisma.stockMovement.create({
        data: {
          deviceDetailId: deviceDetail.id,
          rackId: rack.id,
          transactionType: 'STOCK_ADJUSTMENT_IN',
          transactionId: 51n,
          transactionDetailId: 52n,
          transactionNumber: 'SAI-202607-0051',
          transactionDate: new Date('2026-07-26'),
          quantityIn: 3,
          createdById: user.id,
        },
      })

      await expect(
        prisma.stockMovement.update({
          where: { id: original.id },
          data: { engineerName: 'Mutated' },
        }),
      ).rejects.toThrow()
      await expect(prisma.stockMovement.delete({ where: { id: original.id } })).rejects.toThrow()
    })
  })
})
