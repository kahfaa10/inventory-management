import { Prisma, TransactionType } from '../../generated/prisma/client'
import type { TransactionNumberPrefix } from '../../shared/types/stock'
import { ApiError } from '../utils/api-error'

export const MAX_TRANSACTION_SEQUENCE = 2_147_483_647

const PREFIX_BY_TRANSACTION_TYPE = {
  [TransactionType.STOCK_ADJUSTMENT_IN]: 'SAI',
  [TransactionType.STOCK_RELEASE]: 'SRL',
  [TransactionType.STOCK_RETURN]: 'SRT',
} as const satisfies Record<TransactionType, TransactionNumberPrefix>

function yearMonth(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new ApiError(422, 'INVALID_TRANSACTION_NUMBER', 'Transaction number date must be valid.')
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

export function transactionNumberPrefix(type: TransactionType): TransactionNumberPrefix {
  return PREFIX_BY_TRANSACTION_TYPE[type]
}

export function formatTransactionNumber(
  prefix: TransactionNumberPrefix,
  date: Date,
  sequence: number,
): string {
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || sequence > MAX_TRANSACTION_SEQUENCE) {
    throw new ApiError(
      422,
      'INVALID_TRANSACTION_NUMBER',
      `Transaction number sequence must be an integer from 1 to ${MAX_TRANSACTION_SEQUENCE}.`,
    )
  }

  return `${prefix}-${yearMonth(date)}-${String(sequence).padStart(4, '0')}`
}

function transactionNumberExhaustedError(): ApiError {
  return new ApiError(
    409,
    'TRANSACTION_NUMBER_EXHAUSTED',
    'Transaction number sequence is exhausted for this month.',
  )
}

function isDatabaseIntegerOverflow(error: unknown): boolean {
  return (
    (error instanceof Error && /integer out of range|value out of range/i.test(error.message)) ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2020')
  )
}

export async function nextTransactionNumber(
  tx: Prisma.TransactionClient,
  type: TransactionType,
  date: Date,
): Promise<string> {
  const counterMonth = yearMonth(date)
  const currentCounter = await tx.transactionCounter.findUnique({
    where: {
      transactionType_yearMonth: {
        transactionType: type,
        yearMonth: counterMonth,
      },
    },
    select: { lastNumber: true },
  })
  if (currentCounter?.lastNumber === MAX_TRANSACTION_SEQUENCE) {
    throw transactionNumberExhaustedError()
  }

  try {
    const counter = await tx.transactionCounter.upsert({
      where: {
        transactionType_yearMonth: {
          transactionType: type,
          yearMonth: counterMonth,
        },
      },
      create: {
        transactionType: type,
        yearMonth: counterMonth,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
      select: {
        lastNumber: true,
      },
    })

    return formatTransactionNumber(transactionNumberPrefix(type), date, counter.lastNumber)
  } catch (error) {
    if (isDatabaseIntegerOverflow(error)) throw transactionNumberExhaustedError()
    throw error
  }
}
