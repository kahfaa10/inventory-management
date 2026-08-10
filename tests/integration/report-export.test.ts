import ExcelJS from 'exceljs'
import { afterAll, describe, expect, it } from 'vitest'
import { UserRole } from '../../generated/prisma/client'
import {
  buildStockCardByCustomerWorkbook,
  buildStockCardWorkbook,
  buildStockInByCustomerWorkbook,
  buildStockInWorkbook,
  buildStockOutByCustomerWorkbook,
  buildStockOutWorkbook,
  reportWorkbookDefinitions,
  type ReportColumn,
} from '../../server/services/excel.service'
import {
  cancelStockAdjustmentIn,
  completeStockAdjustmentIn,
  createStockAdjustmentIn,
} from '../../server/services/stock-adjustment-in.service'
import {
  completeStockRelease,
  createStockRelease,
} from '../../server/services/stock-release.service'
import { completeStockReturn, createStockReturn } from '../../server/services/stock-return.service'
import type {
  StockCardReportRow,
  StockInReportRow,
  StockOutReportRow,
} from '../../shared/types/reports'
import {
  getStockCardByCustomerReport,
  getStockCardReport,
  getStockInByCustomerReport,
  getStockInReport,
  getStockOutByCustomerReport,
  getStockOutReport,
} from '../../server/services/report.service'
import { prisma, withCleanDatabase } from '../helpers/database'

async function fixture(detailCount = 1) {
  const user = await prisma.user.create({
    data: {
      email: 'excel@example.com',
      displayName: 'Excel User',
      passwordHash: 'not-used',
      role: UserRole.USER,
    },
  })
  const customer = await prisma.customer.create({ data: { customerName: 'Excel Customer' } })
  const otherCustomer = await prisma.customer.create({ data: { customerName: 'Other Customer' } })
  const model = await prisma.model.create({ data: { modelName: 'Excel Model' } })
  const tag = await prisma.serviceTag.create({
    data: { modelId: model.id, customerId: customer.id, serviceTag: 'EXCEL-TAG' },
  })
  const device = await prisma.device.create({ data: { deviceName: 'Excel Device' } })
  const detail = await prisma.deviceDetail.create({
    data: {
      deviceId: device.id,
      partNumber: 'EXCEL-PART',
      dpn: 'EXCEL-DPN',
      specification: 'Excel specification',
    },
  })
  const rack = await prisma.rack.create({ data: { rackCode: 'EXCEL', rackName: 'Excel Rack' } })
  await completeStockAdjustmentIn(
    (
      await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-01',
        customerId: customer.id.toString(),
        notes: '@formula-like note',
        details: Array.from({ length: detailCount }, () => ({
          deviceDetailId: detail.id.toString(),
          destinationRackId: rack.id.toString(),
          quantity: 10,
        })),
      })
    ).id,
    user.id,
  )
  const release = await completeStockRelease(
    (
      await createStockRelease(user.id, {
        releaseDate: '2026-07-02',
        engineerName: 'Excel Engineer',
        customerId: customer.id.toString(),
        modelId: model.id.toString(),
        serviceTagId: tag.id.toString(),
        referenceNumber: 'EXCEL-REF',
        details: [
          {
            deviceDetailId: detail.id.toString(),
            sourceRackId: rack.id.toString(),
            releasedQuantity: 3,
          },
        ],
      })
    ).id,
    user.id,
  )
  await completeStockReturn(
    (
      await createStockReturn(user.id, {
        returnDate: '2026-07-03',
        stockReleaseId: release.id,
        details: [
          {
            stockReleaseDetailId: release.details[0]!.id,
            destinationRackId: rack.id.toString(),
            returnQuantity: 1,
          },
        ],
      })
    ).id,
    user.id,
  )
  const cancelledAdjustment = await completeStockAdjustmentIn(
    (
      await createStockAdjustmentIn(user.id, {
        transactionDate: '2026-07-04',
        customerId: customer.id.toString(),
        details: [
          {
            deviceDetailId: detail.id.toString(),
            destinationRackId: rack.id.toString(),
            quantity: 2,
          },
        ],
      })
    ).id,
    user.id,
  )
  await cancelStockAdjustmentIn(cancelledAdjustment.id, user.id)
  return { customer, otherCustomer, detail, rack }
}

async function workbookRows(buffer: Buffer, sheetName: string): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.getWorksheet(sheetName)!
  const rows: unknown[][] = []
  for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber += 1) {
    rows.push(
      Array.from({ length: sheet.columnCount }, (_, columnIndex) => {
        const value = sheet.getRow(rowNumber).getCell(columnIndex + 1).value
        return value instanceof Date ? value.toISOString().slice(0, 10) : (value ?? null)
      }),
    )
  }
  return rows
}

function displayedRows<TRow>(rows: TRow[], columns: ReportColumn<TRow>[]): unknown[][] {
  return rows.map((row) =>
    columns.map((column) => {
      const value = column.value(row)
      return typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : (value ?? null)
    }),
  )
}

describe('Excel report exports', () => {
  it('matches normalized filtered reports for all six workbooks', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture()
      const customerId = data.customer.id.toString()
      const cases = [
        {
          filters: { dateFrom: '2026-07-02', rackId: data.rack.id.toString() },
          report: getStockCardReport,
          build: buildStockCardWorkbook,
          definition: reportWorkbookDefinitions.stockCard,
        },
        {
          filters: { customerId, deviceDetailId: data.detail.id.toString() },
          report: getStockCardByCustomerReport,
          build: buildStockCardByCustomerWorkbook,
          definition: reportWorkbookDefinitions.stockCardByCustomer,
        },
        {
          filters: { dateTo: '2026-07-02', rackId: data.rack.id.toString() },
          report: getStockInReport,
          build: buildStockInWorkbook,
          definition: reportWorkbookDefinitions.stockIn,
        },
        {
          filters: { customerId, stockInType: 'RETURN' },
          report: getStockInByCustomerReport,
          build: buildStockInByCustomerWorkbook,
          definition: reportWorkbookDefinitions.stockInByCustomer,
        },
        {
          filters: { engineerName: 'Excel', rackId: data.rack.id.toString() },
          report: getStockOutReport,
          build: buildStockOutWorkbook,
          definition: reportWorkbookDefinitions.stockOut,
        },
        {
          filters: { customerId, serviceTagId: undefined },
          report: getStockOutByCustomerReport,
          build: buildStockOutByCustomerWorkbook,
          definition: reportWorkbookDefinitions.stockOutByCustomer,
        },
      ] as const

      for (const testCase of cases) {
        const result = await testCase.report({
          ...testCase.filters,
          page: 1,
          pageSize: 100,
        } as never)
        const rows = await workbookRows(
          await testCase.build(testCase.filters),
          testCase.definition.sheetName,
        )
        expect(rows).toEqual(
          displayedRows(
            result.rows as StockCardReportRow[] & StockInReportRow[] & StockOutReportRow[],
            testCase.definition.columns as ReportColumn<
              StockCardReportRow & StockInReportRow & StockOutReportRow
            >[],
          ),
        )
      }

      const otherCustomerWorkbook = await buildStockInByCustomerWorkbook({
        customerId: data.otherCustomer.id.toString(),
      })
      expect(
        await workbookRows(
          otherCustomerWorkbook,
          reportWorkbookDefinitions.stockInByCustomer.sheetName,
        ),
      ).toEqual([])

      const cancelledCard = await workbookRows(
        await buildStockCardWorkbook({ dateFrom: '2026-07-04', dateTo: '2026-07-04' }),
        reportWorkbookDefinitions.stockCard.sheetName,
      )
      expect(cancelledCard.map((row) => row.slice(10, 13))).toEqual([
        [2, 0, 10],
        [0, 2, 8],
      ])
      const cancelledFlow = await workbookRows(
        await buildStockInWorkbook({ dateFrom: '2026-07-04', dateTo: '2026-07-04' }),
        reportWorkbookDefinitions.stockIn.sheetName,
      )
      expect(cancelledFlow).toEqual([])
    })
  })

  it('exports every filtered row across pages with typed cells and safe formula-like text', async () => {
    await withCleanDatabase(async () => {
      const data = await fixture(101)
      const buffer = await buildStockInWorkbook({
        deviceDetailId: data.detail.id.toString(),
        dateTo: '2026-07-01',
      })
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.getWorksheet('Stock In')!
      expect(sheet.rowCount - 5).toBe(101)
      expect(sheet.getCell('A6').value).toBeInstanceOf(Date)
      expect(typeof sheet.getCell('H6').value).toBe('number')
      expect(sheet.getCell('L6').value).toBe("'@formula-like note")
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 })
      expect(sheet.autoFilter).toBeTruthy()
      expect(sheet.getCell('B3').value).toContain(`deviceDetailId: ${data.detail.id}`)
    })
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
