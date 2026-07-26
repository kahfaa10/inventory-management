import { describe, expect, it, vi } from 'vitest'
import { Prisma, TransactionType } from '../../generated/prisma/client'
import {
  formatTransactionNumber,
  transactionNumberPrefix,
} from '../../server/services/transaction-number.service'
import {
  createInventoryTransactionRunner,
  MAX_SERIALIZABLE_RETRIES,
} from '../../server/utils/transaction'
import { advisoryLockPair, normalizeStockLockKeys } from '../../server/utils/stock-lock'

describe('transaction numbering', () => {
  it.each([
    ['SAI', 1, 'SAI-202607-0001'],
    ['SRL', 42, 'SRL-202607-0042'],
    ['SRT', 10_001, 'SRT-202607-10001'],
  ] as const)('formats %s numbers with a stable UTC month', (prefix, sequence, expected) => {
    expect(formatTransactionNumber(prefix, new Date('2026-07-19T23:30:00-07:00'), sequence)).toBe(
      expected,
    )
  })

  it('maps every transaction type to its approved prefix', () => {
    expect(transactionNumberPrefix(TransactionType.STOCK_ADJUSTMENT_IN)).toBe('SAI')
    expect(transactionNumberPrefix(TransactionType.STOCK_RELEASE)).toBe('SRL')
    expect(transactionNumberPrefix(TransactionType.STOCK_RETURN)).toBe('SRT')
  })
})

describe('serializable inventory transactions', () => {
  it('retries only P2034 conflicts, up to three retries', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '7.8.0',
    })
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockResolvedValue('posted')
    const run = createInventoryTransactionRunner({ $transaction: transaction })

    await expect(run(async () => 'unused')).resolves.toBe('posted')
    expect(transaction).toHaveBeenCalledTimes(MAX_SERIALIZABLE_RETRIES + 1)
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('does not retry another Prisma error code', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    })
    const transaction = vi.fn().mockRejectedValue(error)
    const run = createInventoryTransactionRunner({ $transaction: transaction })

    await expect(run(async () => 'unused')).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledOnce()
  })

  it('stops after the third P2034 retry', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '7.8.0',
    })
    const transaction = vi.fn().mockRejectedValue(error)
    const run = createInventoryTransactionRunner({ $transaction: transaction })

    await expect(run(async () => 'unused')).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(MAX_SERIALIZABLE_RETRIES + 1)
  })
})

describe('stock advisory lock keys', () => {
  it('derives signed 32-bit pairs and returns sorted unique keys', () => {
    const keys = normalizeStockLockKeys([
      { deviceDetailId: 4_294_967_297n, rackId: 4_294_967_298n },
      { deviceDetailId: 1n, rackId: 2n },
      { deviceDetailId: 2_147_483_648n, rackId: 4_294_967_295n },
    ])

    expect(advisoryLockPair({ deviceDetailId: 2_147_483_648n, rackId: 4_294_967_295n })).toEqual([
      -2_147_483_648, -1,
    ])
    expect(keys).toEqual([
      [-2_147_483_648, -1],
      [1, 2],
    ])
  })
})
