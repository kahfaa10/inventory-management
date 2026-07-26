import { Prisma } from '../../generated/prisma/client'
import { prisma } from './prisma'

export const MAX_SERIALIZABLE_RETRIES = 3

type InventoryOperation<T> = (tx: Prisma.TransactionClient) => Promise<T>

interface TransactionHost {
  $transaction<T>(
    operation: InventoryOperation<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>
}

const RETRYABLE_POSTGRES_CONCURRENCY_CODES = new Set(['40001', '40P01'])

function retryableSqlState(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 4) return false

  const record = value as Record<string, unknown>
  for (const key of ['code', 'sqlState', 'originalCode']) {
    if (typeof record[key] === 'string' && RETRYABLE_POSTGRES_CONCURRENCY_CODES.has(record[key])) {
      return true
    }
  }

  return ['database_error', 'driverAdapterError', 'cause'].some((key) =>
    retryableSqlState(record[key], depth + 1),
  )
}

function isSerializableConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034' || (error.code === 'P2010' && retryableSqlState(error.meta))
  }

  return retryableSqlState(error)
}

export function createInventoryTransactionRunner(client: TransactionHost) {
  return async function run<T>(operation: InventoryOperation<T>): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await client.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      } catch (error) {
        if (!isSerializableConflict(error) || retry >= MAX_SERIALIZABLE_RETRIES) {
          throw error
        }
      }
    }
  }
}

export const runInventoryTransaction = createInventoryTransactionRunner(prisma)
