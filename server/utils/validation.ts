import { ZodError, type ZodType } from 'zod'
import { ApiError } from './api-error'

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw ApiError.fromZodError(error)
    }
    throw error
  }
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  try {
    return schema.parse(query)
  } catch (error) {
    if (error instanceof ZodError) {
      throw ApiError.fromZodError(error)
    }
    throw error
  }
}
