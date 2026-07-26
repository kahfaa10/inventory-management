import type { PaginatedResponse } from '#shared/types/api'

interface ActiveMasterOption {
  id: string
}

type ActiveOptionFetcher = <T>(
  endpoint: string,
  options: { query: { isActive: true; page: number; pageSize: number } },
) => Promise<PaginatedResponse<T>>

const OPTION_PAGE_SIZE = 100

export async function loadAllActiveMasterOptions<T extends ActiveMasterOption>(
  endpoint: string,
  fetcher: ActiveOptionFetcher = $fetch,
): Promise<T[]> {
  const records: T[] = []
  let page = 1

  while (true) {
    const response = await fetcher<T>(endpoint, {
      query: { isActive: true, page, pageSize: OPTION_PAGE_SIZE },
    })
    records.push(...response.data)

    if (records.length >= response.total) return records
    if (response.data.length === 0) {
      throw new Error(
        `Active option loading for ${endpoint} stopped before all records were loaded.`,
      )
    }
    page += 1
  }
}

export function useActiveMasterOptions<T extends ActiveMasterOption>(endpoint: string) {
  return useAsyncData(`active-master-options:${endpoint}`, () =>
    loadAllActiveMasterOptions<T>(endpoint),
  )
}
