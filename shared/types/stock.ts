export type TransactionNumberPrefix = 'SAI' | 'SRL' | 'SRT'

export interface StockKey {
  deviceDetailId: bigint
  rackId: bigint
}

export interface StockBalanceResponse {
  deviceDetailId: string
  rackId: string
  balance: number
}
