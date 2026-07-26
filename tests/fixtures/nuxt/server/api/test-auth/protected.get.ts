import { requireAppUser } from '../../../../../../server/utils/auth'

export default defineEventHandler(async (event) => ({
  user: await requireAppUser(event),
}))
