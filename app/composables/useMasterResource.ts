import type { PaginatedResponse } from '#shared/types/api'

interface MasterRecord {
  id: string
  isActive: boolean
}

export function useMasterResource<T extends MasterRecord>(
  endpoint: string,
  filterNames: readonly string[] = [],
) {
  const toast = useToast()
  const { user } = useUserSession()
  const search = ref('')
  const activeFilter = ref('all')
  const page = ref(1)
  const pageSize = 20
  const filters = reactive<Record<string, string>>(
    Object.fromEntries(filterNames.map((name) => [name, ''])),
  )
  const submitting = ref(false)
  const canWrite = computed(() => user.value?.role === 'ADMIN')
  const query = computed(() => ({
    page: page.value,
    pageSize,
    ...(search.value ? { search: search.value } : {}),
    ...(activeFilter.value === 'all' ? {} : { isActive: activeFilter.value }),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  }))
  const { data, pending, refresh } = useFetch<PaginatedResponse<T>>(endpoint, { query })

  watch([search, activeFilter, ...filterNames.map((name) => () => filters[name])], () => {
    page.value = 1
  })

  async function save(id: string | undefined, body: Record<string, unknown>) {
    submitting.value = true
    try {
      await $fetch(id ? `${endpoint}/${id}` : endpoint, {
        method: id ? 'PUT' : 'POST',
        body,
      })
      toast.add({ title: id ? 'Record updated' : 'Record created', color: 'success' })
      await refresh()
    } catch (error) {
      const response = error as {
        data?: { data?: { message?: string }; message?: string }
      }
      toast.add({
        title: 'Unable to save record',
        description: response.data?.data?.message ?? response.data?.message ?? 'Please try again.',
        color: 'error',
      })
      throw error
    } finally {
      submitting.value = false
    }
  }

  async function toggle(row: T) {
    await save(row.id, { isActive: !row.isActive })
  }

  return {
    rows: computed(() => data.value?.data ?? []),
    total: computed(() => data.value?.total ?? 0),
    pending,
    search,
    activeFilter,
    page,
    pageSize,
    filters,
    submitting,
    canWrite,
    save,
    toggle,
    refresh,
  }
}
