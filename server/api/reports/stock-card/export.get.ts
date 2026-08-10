import { getQuery, setResponseHeaders } from 'h3'
import { buildStockCardWorkbook, reportExportFilename } from '../../../services/excel.service'
import { requireAppUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  const buffer = await buildStockCardWorkbook(getQuery(event))
  setResponseHeaders(event, {
    'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'content-disposition': `attachment; filename="${reportExportFilename('stock-card')}"`,
    'content-length': buffer.byteLength,
    'cache-control': 'no-store',
  })
  return buffer
})
