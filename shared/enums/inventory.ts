export const TRANSACTION_STATUSES = ['DRAFT', 'COMPLETED', 'CANCELLED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const TRANSACTION_TYPES = ['STOCK_ADJUSTMENT_IN', 'STOCK_RELEASE', 'STOCK_RETURN'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const MOVEMENT_PURPOSES = ['ORIGINAL', 'CANCELLATION_REVERSAL'] as const
export type MovementPurpose = (typeof MOVEMENT_PURPOSES)[number]
