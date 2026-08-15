import { getRouterParam, setResponseStatus, type H3Event } from 'h3'
import { idSchema } from '../../shared/schemas/common'
import { requireAppUser, requireRole } from './auth'
import { parseBody } from './validation'

export const requireMasterRead = (event: H3Event) => requireAppUser(event)

export const requireMasterWrite = (event: H3Event) => requireRole(event, ['ADMIN'])

export function validatedMasterId(event: H3Event): string {
  return parseBody(idSchema, getRouterParam(event, 'id'))
}

export function created<T>(event: H3Event, value: T): T {
  setResponseStatus(event, 201)
  return value
}
