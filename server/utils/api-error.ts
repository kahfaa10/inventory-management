import { H3Error } from 'h3'
import type { ZodError } from 'zod'

export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
}

export class ApiError extends H3Error<Omit<ApiErrorBody, 'statusCode'>> {
  override statusCode: number
  readonly code: string
  readonly fieldErrors?: Record<string, string[]>
  override data: Omit<ApiErrorBody, 'statusCode'>

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.fieldErrors = fieldErrors
    this.data = {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    }
  }

  toBody(): ApiErrorBody {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
    }
  }

  static fromZodError(error: ZodError): ApiError {
    const fieldErrors: Record<string, string[]> = {}

    for (const issue of error.issues) {
      const field = issue.path.length > 0 ? issue.path.join('.') : '_form'
      fieldErrors[field] ??= []
      fieldErrors[field].push(issue.message)
    }

    return new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', fieldErrors)
  }
}
