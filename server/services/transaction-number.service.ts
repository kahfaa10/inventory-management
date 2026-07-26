import { TransactionType, type Prisma } from '../../generated/prisma/client'
import type { TransactionNumberPrefix } from '../../shared/types/stock'

const PREFIX_BY_TRANSACTION_TYPE = {
  [TransactionType.STOCK_ADJUSTMENT_IN]: 'SAI',
  [TransactionType.STOCK_RELEASE]: 'SRL',
  [TransactionType.STOCK_RETURN]: 'SRT',
} as const satisfies Record<TransactionType, TransactionNumberPrefix>

function yearMonth(date: Date): string {
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
  return `${prefix}-${yearMonth(date)}-${String(sequence).padStart(4, '0')}`
}

export async function nextTransactionNumber(
  tx: Prisma.TransactionClient,
  type: TransactionType,
  date: Date,
): Promise<string> {
  const counterMonth = yearMonth(date)
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
}
