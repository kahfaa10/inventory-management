import { Prisma } from '../../generated/prisma/client'
import type { StockKey } from '../../shared/types/stock'

type AdvisoryLockPair = readonly [deviceKey: number, rackKey: number]
type StockLockClient = Pick<Prisma.TransactionClient, '$executeRaw'>

function signedInt32(value: bigint): number {
  return Number(BigInt.asIntN(32, value))
}

export function advisoryLockPair(key: StockKey): AdvisoryLockPair {
  return [signedInt32(key.deviceDetailId), signedInt32(key.rackId)]
}

export function normalizeStockLockKeys(keys: readonly StockKey[]): AdvisoryLockPair[] {
  const uniquePairs = new Map<string, AdvisoryLockPair>()

  for (const key of keys) {
    const pair = advisoryLockPair(key)
    uniquePairs.set(`${pair[0]}:${pair[1]}`, pair)
  }

  return [...uniquePairs.values()].sort(
    ([leftDevice, leftRack], [rightDevice, rightRack]) =>
      leftDevice - rightDevice || leftRack - rightRack,
  )
}

export async function lockStockKeys(tx: StockLockClient, keys: readonly StockKey[]): Promise<void> {
  for (const [deviceKey, rackKey] of normalizeStockLockKeys(keys)) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${deviceKey}, ${rackKey})`)
  }
}
