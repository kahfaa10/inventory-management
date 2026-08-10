import type { StockBalanceResponse } from '#shared/types/stock'

export function useStockAvailability() {
  const balances = reactive<Record<string, number>>({})
  const pendingKeys = reactive(new Set<string>())
  const errors = reactive(new Map<string, string>())

  const keyFor = (deviceDetailId: string, rackId: string) => `${deviceDetailId}:${rackId}`

  async function refresh(deviceDetailId?: string, rackId?: string, force = false) {
    if (!deviceDetailId || !rackId) return undefined

    const key = keyFor(deviceDetailId, rackId)
    if (!force && balances[key] !== undefined) return balances[key]
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

  async function refreshRacks(
    deviceDetailId: string | undefined,
    rackIds: readonly string[],
    force = false,
  ) {
    if (!deviceDetailId) return
    await Promise.all(rackIds.map((rackId) => refresh(deviceDetailId, rackId, force)))
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

  function isDevicePending(deviceDetailId?: string) {
    if (!deviceDetailId) return false
    return [...pendingKeys].some((key) => key.startsWith(`${deviceDetailId}:`))
  }

  function deviceError(deviceDetailId?: string) {
    if (!deviceDetailId) return undefined
    for (const [key, message] of errors) {
      if (key.startsWith(`${deviceDetailId}:`)) return message
    }
    return undefined
  }

  return { refresh, refreshRacks, balance, isPending, error, isDevicePending, deviceError }
}
