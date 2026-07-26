import { isError } from 'h3'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../server/utils/api-error'

describe('ApiError', () => {
  it('is an H3-handled error with a safe structured response payload', () => {
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', {
      email: ['Enter a valid email address.'],
    })

    expect(isError(error)).toBe(true)
    expect(error.unhandled).toBe(false)
    expect(error.toJSON()).toMatchObject({
      statusCode: 422,
      message: 'Request validation failed.',
      data: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        fieldErrors: {
          email: ['Enter a valid email address.'],
        },
      },
    })
  })
})
