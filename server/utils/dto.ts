type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export function serializeBigInts(value: unknown): JsonValue {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(serializeBigInts)

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeBigInts(nestedValue)]),
    )
  }

  throw new TypeError(`Cannot serialize value of type ${typeof value}.`)
}
