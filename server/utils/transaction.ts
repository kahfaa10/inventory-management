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

function isSerializableConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
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
