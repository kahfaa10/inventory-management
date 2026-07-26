import { Prisma } from '../../generated/prisma/client'
import { VALIDATION_MESSAGES } from '../../shared/validation/messages'
import { ApiError } from './api-error'

export const duplicateRecordError = () =>
  new ApiError(409, 'DUPLICATE_RECORD', VALIDATION_MESSAGES.duplicate)

export const notFoundError = () => new ApiError(404, 'NOT_FOUND', VALIDATION_MESSAGES.notFound)

export const inactiveMasterError = () =>
  new ApiError(422, 'INACTIVE_MASTER', VALIDATION_MESSAGES.inactiveMaster)

export function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw duplicateRecordError()
    }
    if (error.code === 'P2025') {
      throw notFoundError()
    }
  }

  throw error
}

export async function executeMasterWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    return translatePrismaError(error)
  }
}
