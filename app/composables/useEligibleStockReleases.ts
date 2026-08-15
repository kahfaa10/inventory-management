import type { PaginatedResponse } from '#shared/types/api'
import type { StockReleaseReturnableDto } from '#shared/types/transactions'

type EligibleReleaseFetcher = <T>(
  endpoint: string,
  options: { query: { page: number; pageSize: number } },
) => Promise<PaginatedResponse<T>>

const ELIGIBLE_PAGE_SIZE = 100
const ELIGIBLE_ENDPOINT = '/api/stock-returns/eligible-releases'

export async function loadAllEligibleStockReleases(
  fetcher: EligibleReleaseFetcher = $fetch,
): Promise<PaginatedResponse<StockReleaseReturnableDto>> {
  const data: StockReleaseReturnableDto[] = []
  let page = 1
  let total: number | undefined

  while (total === undefined || data.length < total) {
    const response = await fetcher<StockReleaseReturnableDto>(ELIGIBLE_ENDPOINT, {
      query: { page, pageSize: ELIGIBLE_PAGE_SIZE },
    })
    data.push(...response.data)
    total = response.total
    if (response.data.length === 0 && data.length < total) {
      throw new Error('Eligible Stock Release loading stopped before all records were loaded.')
    }
    page += 1
  }

  return { data, page: 1, pageSize: ELIGIBLE_PAGE_SIZE, total: total ?? 0 }
}
