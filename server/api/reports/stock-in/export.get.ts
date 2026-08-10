import { getQuery, setResponseHeaders } from 'h3'
import { buildStockInWorkbook, reportExportFilename } from '../../../services/excel.service'
import { requireAppUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAppUser(event)
  const buffer = await buildStockInWorkbook(getQuery(event))
  setResponseHeaders(event, {
    'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'content-disposition': `attachment; filename="${reportExportFilename('stock-in')}"`,
    'content-length': buffer.byteLength,
    'cache-control': 'no-store',
  })
  return buffer
})
