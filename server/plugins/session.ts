import { requireAppUser } from '../utils/auth'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (!session.user) {
      return
    }

    session.user = await requireAppUser(event)
  })
})
