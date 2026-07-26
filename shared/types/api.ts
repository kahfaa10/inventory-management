export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}

export interface MasterService<T, TCreate = unknown, TUpdate = unknown> {
  list(query?: unknown): Promise<PaginatedResponse<T>>
  create(actorId: bigint | string, input: TCreate): Promise<T>
  update(actorId: bigint | string, id: string, input: TUpdate): Promise<T>
}
