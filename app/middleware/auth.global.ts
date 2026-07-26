export default defineNuxtRouteMiddleware(async (to) => {
  const { fetch, loggedIn, ready } = useUserSession()

  if (!ready.value) {
    await fetch().catch(() => undefined)
  }

  if (to.path === '/login') {
    if (loggedIn.value) {
      return navigateTo('/')
    }

    return
  }

  if (!loggedIn.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
})
