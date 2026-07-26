import { describe, expect, it, vi } from 'vitest'
import { Prisma, TransactionType } from '../../generated/prisma/client'
import {
  formatTransactionNumber,
  MAX_TRANSACTION_SEQUENCE,
  nextTransactionNumber,
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

  it.each([
    [new Date(Number.NaN), 1],
    [new Date('2026-07-19'), 0],
    [new Date('2026-07-19'), -1],
    [new Date('2026-07-19'), 1.5],
    [new Date('2026-07-19'), MAX_TRANSACTION_SEQUENCE + 1],
  ])('rejects an invalid date or sequence (%s, %s)', (date, sequence) => {
    expect(() => formatTransactionNumber('SAI', date, sequence)).toThrowError(
      expect.objectContaining({
        statusCode: 422,
        code: 'INVALID_TRANSACTION_NUMBER',
      }),
    )
  })

  it('returns a stable exhaustion error before incrementing a full PostgreSQL Int counter', async () => {
    const tx = {
      transactionCounter: {
        findUnique: vi.fn().mockResolvedValue({ lastNumber: MAX_TRANSACTION_SEQUENCE }),
        upsert: vi.fn(),
      },
    }

    await expect(
      nextTransactionNumber(
        tx as unknown as Prisma.TransactionClient,
        TransactionType.STOCK_ADJUSTMENT_IN,
        new Date('2026-07-19'),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'TRANSACTION_NUMBER_EXHAUSTED',
    })
    expect(tx.transactionCounter.upsert).not.toHaveBeenCalled()
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

  it.each(['40001', '40P01'])(
    'retries a raw-query PostgreSQL %s concurrency conflict wrapped as P2010',
    async (databaseCode) => {
      const conflict = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
        code: 'P2010',
        clientVersion: '7.8.0',
        meta: {
          database_error: {
            code: databaseCode,
            message: 'concurrent transaction conflict',
          },
        },
      })
      const transaction = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue('posted')
      const run = createInventoryTransactionRunner({ $transaction: transaction })

      await expect(run(async () => 'unused')).resolves.toBe('posted')
      expect(transaction).toHaveBeenCalledTimes(2)
    },
  )

  it('does not retry a non-concurrency raw-query error wrapped as P2010', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: '7.8.0',
      meta: {
        database_error: {
          code: '23505',
          message: 'unique constraint violation',
        },
      },
    })
    const transaction = vi.fn().mockRejectedValue(error)
    const run = createInventoryTransactionRunner({ $transaction: transaction })

    await expect(run(async () => 'unused')).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledOnce()
  })

  it.each([
    [
      'P2034',
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '7.8.0',
      }),
    ],
    [
      'P2010/40001',
      new Prisma.PrismaClientKnownRequestError('Raw query failed', {
        code: 'P2010',
        clientVersion: '7.8.0',
        meta: { database_error: { code: '40001' } },
      }),
    ],
    [
      'P2010/40P01',
      new Prisma.PrismaClientKnownRequestError('Raw query failed', {
        code: 'P2010',
        clientVersion: '7.8.0',
        meta: { database_error: { code: '40P01' } },
      }),
    ],
  ])('translates exhausted %s retries into a stable HTTP 409 error', async (_case, error) => {
    const transaction = vi.fn().mockRejectedValue(error)
    const run = createInventoryTransactionRunner({ $transaction: transaction })

    await expect(run(async () => 'unused')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONCURRENT_TRANSACTION_CONFLICT',
      message: 'The transaction conflicted with another request. Please try again.',
    })
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
