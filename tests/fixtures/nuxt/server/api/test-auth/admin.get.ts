import { requireRole } from '../../../../../../server/utils/auth'

export default defineEventHandler(async (event) => ({
  user: await requireRole(event, ['ADMIN']),
}))
