import type { StockBalanceResponse } from '#shared/types/stock'

export function useStockAvailability() {
  const balances = reactive<Record<string, number>>({})
  const pendingKeys = reactive(new Set<string>())
  const errors = reactive(new Map<string, string>())

  const keyFor = (deviceDetailId: string, rackId: string) => `${deviceDetailId}:${rackId}`

  async function refresh(deviceDetailId?: string, rackId?: string) {
    if (!deviceDetailId || !rackId) return undefined

    const key = keyFor(deviceDetailId, rackId)
    pendingKeys.add(key)
    errors.delete(key)
    try {
      const result = await $fetch<StockBalanceResponse>('/api/stock/balance', {
        query: { deviceDetailId, rackId },
      })
      balances[key] = result.balance
      return result.balance
    } catch (error) {
      const response = error as { data?: { data?: { message?: string }; message?: string } }
      errors.set(
        key,
        response.data?.data?.message ??
          response.data?.message ??
          'Availability could not be loaded.',
      )
      return undefined
    } finally {
      pendingKeys.delete(key)
    }
  }

  function balance(deviceDetailId?: string, rackId?: string) {
    if (!deviceDetailId || !rackId) return undefined
    return balances[keyFor(deviceDetailId, rackId)]
  }

  function isPending(deviceDetailId?: string, rackId?: string) {
    return Boolean(deviceDetailId && rackId && pendingKeys.has(keyFor(deviceDetailId, rackId)))
  }

  function error(deviceDetailId?: string, rackId?: string) {
    if (!deviceDetailId || !rackId) return undefined
    return errors.get(keyFor(deviceDetailId, rackId))
  }

  return { refresh, balance, isPending, error }
}
