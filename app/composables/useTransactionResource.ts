import type { PaginatedResponse } from '#shared/types/api'
import type { TransactionStatus } from '#shared/enums/inventory'

interface TransactionRecord {
  id: string
  status: TransactionStatus
}

interface TransactionApiError {
  message: string
  fieldErrors: Record<string, string[]>
}

function apiError(error: unknown): TransactionApiError {
  const response = error as {
    data?: {
      data?: { message?: string; fieldErrors?: Record<string, string[]> }
      message?: string
      fieldErrors?: Record<string, string[]>
    }
  }
  const body = response.data?.data ?? response.data
  return {
    message: body?.message ?? 'The transaction request could not be completed.',
    fieldErrors: body?.fieldErrors ?? {},
  }
}

export function useTransactionResource<T extends TransactionRecord>(
  endpoint: string,
  extraFilterNames: readonly string[] = [],
) {
  const toast = useToast()
  const search = ref('')
  const status = ref<'all' | TransactionStatus>('all')
  const dateFrom = ref('')
  const dateTo = ref('')
  const page = ref(1)
  const pageSize = 20
  const filters = reactive<Record<string, string>>(
    Object.fromEntries(extraFilterNames.map((name) => [name, ''])),
  )
  const submitting = ref(false)
  const actionError = ref('')
  const fieldErrors = ref<Record<string, string[]>>({})
  const query = computed(() => ({
    page: page.value,
    pageSize,
    ...(search.value ? { search: search.value } : {}),
    ...(status.value === 'all' ? {} : { status: status.value }),
    ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
    ...(dateTo.value ? { dateTo: dateTo.value } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  }))
  const { data, pending, error, refresh } = useFetch<PaginatedResponse<T>>(endpoint, { query })

  watch(
    [search, status, dateFrom, dateTo, ...extraFilterNames.map((name) => () => filters[name])],
    () => {
      page.value = 1
    },
  )

  async function save(body: Record<string, unknown>, id?: string) {
    submitting.value = true
    actionError.value = ''
    fieldErrors.value = {}
    try {
      const record = await $fetch<T>(id ? `${endpoint}/${id}` : endpoint, {
        method: id ? 'PUT' : 'POST',
        body,
      })
      toast.add({ title: id ? 'Draft updated' : 'Draft created', color: 'success' })
      await refresh()
      return record
    } catch (error) {
      const parsed = apiError(error)
      actionError.value = parsed.message
      fieldErrors.value = parsed.fieldErrors
      throw error
    } finally {
      submitting.value = false
    }
  }

  async function runAction(id: string, action: 'complete' | 'cancel') {
    submitting.value = true
    actionError.value = ''
    try {
      const record = await $fetch<T>(`${endpoint}/${id}/${action}`, { method: 'POST' })
      toast.add({
        title: action === 'complete' ? 'Transaction completed' : 'Transaction cancelled',
        color: 'success',
      })
      await refresh()
      return record
    } catch (error) {
      actionError.value = apiError(error).message
      throw error
    } finally {
      submitting.value = false
    }
  }

  return {
    rows: computed(() => data.value?.data ?? []),
    total: computed(() => data.value?.total ?? 0),
    pending,
    error,
    search,
    status,
    dateFrom,
    dateTo,
    page,
    pageSize,
    filters,
    submitting,
    actionError,
    fieldErrors,
    save,
    runAction,
    refresh,
  }
}

export function useTransactionRecord<T>(endpoint: string, id: MaybeRefOrGetter<string>) {
  return useAsyncData(`transaction:${endpoint}:${toValue(id)}`, () =>
    $fetch<T>(`${endpoint}/${toValue(id)}`),
  )
}
