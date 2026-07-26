export const VALIDATION_MESSAGES = {
  required: (field: string) => `${field} is required.`,
  invalidId: 'Select a valid record.',
  duplicate: 'Duplicate record already exists.',
  inactiveMaster: 'Selected master data is inactive.',
  notFound: 'Record not found.',
  validationFailed: 'Request validation failed.',
} as const
