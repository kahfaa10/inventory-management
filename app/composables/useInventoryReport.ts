import type { ZodType } from 'zod'
import type { PaginatedResponse } from '#shared/types/api'
import type { ReportResult } from '#shared/types/reports'

export type ReportFilterState = Record<string, string>

interface InventoryReportOptions<TFilters extends object> {
  endpoint: string
  exportEndpoint: string
  schema: ZodType<TFilters>
  initialFilters: ReportFilterState
  customerRequired?: boolean
  pageSize?: number
}

interface MasterOptionRecord {
  id: string
}

type MasterOptionFetcher<T extends MasterOptionRecord> = (
  endpoint: string,
  query: { page: number; pageSize: number },
) => Promise<PaginatedResponse<T>>

const REPORT_PAGE_SIZE = 20
const MASTER_OPTION_PAGE_SIZE = 100

function serializeQuery(query: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

export async function loadAllReportMasterOptions<T extends MasterOptionRecord>(
  endpoint: string,
  fetcher: MasterOptionFetcher<T> = (request, query) => $fetch(request, { query }),
): Promise<T[]> {
  const records: T[] = []
  let page = 1

  while (true) {
    const response = await fetcher(endpoint, { page, pageSize: MASTER_OPTION_PAGE_SIZE })
    records.push(...response.data)
    if (records.length >= response.total) return records
    if (response.data.length === 0) {
      throw new Error(`Report option loading for ${endpoint} stopped before all records loaded.`)
    }
    page += 1
  }
}

export function useReportMasterOptions<T extends MasterOptionRecord>(endpoint: string) {
  const requestFetch = useRequestFetch()
  return useAsyncData(`report-master-options:${endpoint}`, () =>
    loadAllReportMasterOptions<T>(endpoint, (request, query) =>
      requestFetch<PaginatedResponse<T>>(request, { query }),
    ),
  )
}

export function useInventoryReport<TRow extends object, TFilters extends object>(
  options: InventoryReportOptions<TFilters>,
) {
  const requestFetch = useRequestFetch()
  const filters = reactive<ReportFilterState>({ ...options.initialFilters })
  const page = ref(1)
  const pageSize = options.pageSize ?? REPORT_PAGE_SIZE

  const activeFilters = computed<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(filters)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ''),
    ),
  )
  const customerSelected = computed(() => !options.customerRequired || !!filters.customerId?.trim())
  const filterSignature = computed(() => serializeQuery(activeFilters.value))

  watch(filterSignature, () => {
    page.value = 1
  })

  const parsedQuery = computed(() =>
    options.schema.safeParse({
      ...activeFilters.value,
      page: page.value,
      pageSize,
    }),
  )
  const query = computed<Record<string, unknown>>(() =>
    parsedQuery.value.success
      ? (parsedQuery.value.data as Record<string, unknown>)
      : { ...activeFilters.value, page: page.value, pageSize },
  )
  const requestSignature = computed(
    () => `${customerSelected.value}:${parsedQuery.value.success}:${serializeQuery(query.value)}`,
  )

  const asyncData = useAsyncData<ReportResult<TRow, TFilters> | null>(
    `inventory-report:${options.endpoint}`,
    async () => {
      if (!customerSelected.value || !parsedQuery.value.success) return null
      return await requestFetch<ReportResult<TRow, TFilters>>(options.endpoint, {
        query: query.value,
      })
    },
    { watch: [requestSignature] },
  )

  const validationMessage = computed(() => {
    if (!customerSelected.value) return ''
    if (parsedQuery.value.success) return ''
    return parsedQuery.value.error.issues[0]?.message ?? 'The selected filters are invalid.'
  })
  const errorMessage = computed(() => {
    if (validationMessage.value) return validationMessage.value
    return asyncData.error.value?.message ?? ''
  })
  const exportUrl = computed(() => {
    if (!customerSelected.value || !parsedQuery.value.success) return ''
    const search = serializeQuery(query.value)
    return search ? `${options.exportEndpoint}?${search}` : options.exportEndpoint
  })

  function replaceFilters(value: ReportFilterState) {
    Object.assign(filters, value)
  }

  return {
    filters,
    replaceFilters,
    activeFilters,
    query,
    page,
    pageSize,
    rows: computed(() => asyncData.data.value?.rows ?? []),
    total: computed(() => asyncData.data.value?.total ?? 0),
    pending: asyncData.pending,
    error: asyncData.error,
    errorMessage,
    refresh: asyncData.refresh,
    customerSelected,
    validationMessage,
    exportUrl,
    canExport: computed(
      () => customerSelected.value && parsedQuery.value.success && !asyncData.pending.value,
    ),
  }
}
