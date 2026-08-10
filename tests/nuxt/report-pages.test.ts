import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '../../app/components/AppSidebar.vue'
import ReportTable from '../../app/components/reports/ReportTable.vue'
import StockCardCustomerPage from '../../app/pages/reports/stock-card-by-customer.vue'
import StockCardPage from '../../app/pages/reports/stock-card.vue'
import StockInCustomerPage from '../../app/pages/reports/stock-in-by-customer.vue'
import StockInPage from '../../app/pages/reports/stock-in.vue'
import StockOutCustomerPage from '../../app/pages/reports/stock-out-by-customer.vue'
import StockOutPage from '../../app/pages/reports/stock-out.vue'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  loaders: new Map<string, () => Promise<unknown>>(),
  pending: false,
  reportError: null as Error | null,
}))

const masterOptions: Record<string, Record<string, unknown>[]> = {
  '/api/customers': [{ id: '30', customerName: 'ACME', isActive: true }],
  '/api/models': [{ id: '40', modelName: 'Server X', isActive: true }],
  '/api/service-tags': [
    {
      id: '50',
      serviceTag: 'TAG-1',
      modelId: '40',
      customerId: '30',
      isActive: true,
    },
  ],
  '/api/devices': [{ id: '10', deviceName: 'Hard Disk', isActive: true }],
  '/api/device-details': [
    {
      id: '11',
      deviceId: '10',
      partNumber: '0B24496',
      specification: '600 GB SAS',
      isActive: true,
    },
  ],
  '/api/racks': [{ id: '20', rackCode: 'A', rackName: 'Rack A', isActive: true }],
}

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ id: '1', name: 'Administrator', role: 'ADMIN' }),
  clear: vi.fn(),
  fetch: vi.fn(),
}))

mockNuxtImport('useRequestFetch', () => () => mocks.request)

mockNuxtImport('useAsyncData', () => (key: string, loader: () => Promise<unknown>) => {
  mocks.loaders.set(key, loader)
  const endpoint = key.replace('report-master-options:', '')
  return {
    data: ref(
      key.startsWith('report-master-options:')
        ? (masterOptions[endpoint] ?? [])
        : { rows: [], page: 1, pageSize: 20, total: 40, filters: {} },
    ),
    pending: ref(mocks.pending),
    error: ref(key.startsWith('inventory-report:') ? mocks.reportError : null),
    refresh: vi.fn(loader),
  }
})

const uiStubs = {
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert">{{ title }} {{ description }}<slot /></div>',
  },
  UButton: {
    inheritAttrs: false,
    props: ['label', 'to', 'href', 'disabled'],
    template:
      '<a v-bind="$attrs" :data-to="to" :href="href" :aria-disabled="disabled">{{ label }}<slot /></a>',
  },
  UCard: { template: '<div><slot /></div>' },
  UFormField: { props: ['label', 'required'], template: '<label>{{ label }}<slot /></label>' },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue', 'type'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UPagination: {
    props: ['page'],
    emits: ['update:page'],
    template:
      '<button aria-label="Next page" @click="$emit(\'update:page\', page + 1)">Page {{ page }}</button>',
  },
  USelect: {
    inheritAttrs: false,
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template:
      '<select v-bind="$attrs" :value="modelValue ?? \'\'" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
  UTable: {
    props: ['columns', 'data'],
    template:
      '<table><thead><tr><th v-for="column in columns" :key="column.accessorKey">{{ column.header }}</th></tr></thead><tbody><tr v-if="!data.length"><td><slot name="empty" /></td></tr></tbody></table>',
  },
}

const mountOptions = { route: '/', global: { stubs: uiStubs } }

beforeEach(() => {
  mocks.request.mockReset().mockResolvedValue({ rows: [], page: 1, pageSize: 20, total: 0 })
  mocks.loaders.clear()
  mocks.pending = false
  mocks.reportError = null
  vi.stubGlobal('$fetch', mocks.request)
})

describe('inventory report pages', () => {
  it('links all six approved reports from the application navigation', async () => {
    const wrapper = await mountSuspended(AppSidebar, mountOptions)
    for (const path of [
      '/reports/stock-card',
      '/reports/stock-card-by-customer',
      '/reports/stock-in',
      '/reports/stock-in-by-customer',
      '/reports/stock-out',
      '/reports/stock-out-by-customer',
    ]) {
      expect(wrapper.find(`[data-to="${path}"]`).exists()).toBe(true)
    }
  })

  it.each([
    [
      StockCardPage,
      'Stock Card Report',
      [
        'Transaction Date',
        'Transaction Number',
        'Transaction Type',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Rack',
        'Customer',
        'Engineer Name',
        'Quantity In',
        'Quantity Out',
        'Running Balance',
        'Notes',
      ],
    ],
    [
      StockCardCustomerPage,
      'Stock Card Report by Customer',
      [
        'Customer',
        'Transaction Date',
        'Transaction Number',
        'Transaction Type',
        'Model',
        'Service Tag',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Rack',
        'Engineer Name',
        'Quantity In',
        'Quantity Out',
        'Notes',
      ],
    ],
    [
      StockInPage,
      'Stock-In Report',
      [
        'Transaction Date',
        'Transaction Number',
        'Stock-In Type',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Quantity',
        'Rack',
        'Customer',
        'Created By',
        'Notes',
      ],
    ],
    [
      StockInCustomerPage,
      'Stock-In Report by Customer',
      [
        'Transaction Date',
        'Transaction Number',
        'Stock-In Type',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Quantity',
        'Rack',
        'Customer',
        'Created By',
        'Notes',
      ],
    ],
    [
      StockOutPage,
      'Stock-Out Report',
      [
        'Release Date',
        'Stock Release Number',
        'Engineer Name',
        'Customer',
        'Model',
        'Service Tag',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Source Rack',
        'Released Quantity',
        'Support Ticket / Reference',
        'Created By',
        'Notes',
      ],
    ],
    [
      StockOutCustomerPage,
      'Stock-Out Report by Customer',
      [
        'Release Date',
        'Stock Release Number',
        'Engineer Name',
        'Customer',
        'Model',
        'Service Tag',
        'Device',
        'Part Number',
        'DP/N',
        'Specification',
        'Source Rack',
        'Released Quantity',
        'Support Ticket / Reference',
        'Created By',
        'Notes',
      ],
    ],
  ])('renders %s with the approved columns', async (page, title, columns) => {
    const wrapper = await mountSuspended(page, mountOptions)
    expect(wrapper.text()).toContain(title)
    if (title.includes('by Customer')) {
      await wrapper.get('[aria-label="Customer"]').setValue('30')
      await flushPromises()
    }
    for (const column of columns) expect(wrapper.text()).toContain(column)
  })

  it('gates Customer reports and never queries until Customer is selected', async () => {
    const wrapper = await mountSuspended(StockInCustomerPage, mountOptions)
    const loader = mocks.loaders.get('inventory-report:/api/reports/stock-in-by-customer')!

    await loader()
    expect(mocks.request).not.toHaveBeenCalledWith(
      '/api/reports/stock-in-by-customer',
      expect.anything(),
    )
    expect(wrapper.text()).toContain('Customer is required')
    expect(wrapper.get('a').attributes('aria-disabled')).toBe('true')

    await wrapper.get('[aria-label="Customer"]').setValue('30')
    await flushPromises()
    await loader()
    expect(mocks.request).toHaveBeenCalledWith('/api/reports/stock-in-by-customer', {
      query: { customerId: '30', page: 1, pageSize: 20 },
    })
  })

  it('uses one active query for JSON and Excel and resets pagination when filters change', async () => {
    const wrapper = await mountSuspended(StockCardPage, mountOptions)
    await wrapper.get('[aria-label="Next page"]').trigger('click')
    expect(wrapper.get('[aria-label="Next page"]').text()).toContain('Page 2')

    await wrapper.get('[aria-label="Part Number"]').setValue('0B24496')
    await flushPromises()
    expect(wrapper.get('[aria-label="Next page"]').text()).toContain('Page 1')

    const loader = mocks.loaders.get('inventory-report:/api/reports/stock-card')!
    await loader()
    const request = mocks.request.mock.calls.find((call) => call[0] === '/api/reports/stock-card')!
    const jsonQuery = request[1].query as Record<string, unknown>
    const exportUrl = wrapper.get('a[href^="/api/reports/stock-card/export?"]').attributes('href')!
    const exportQuery = Object.fromEntries(new URLSearchParams(exportUrl.split('?')[1]!))
    expect(exportQuery).toEqual(
      Object.fromEntries(Object.entries(jsonQuery).map(([k, v]) => [k, String(v)])),
    )
  })

  it('renders stable loading, empty, and error states', async () => {
    const loading = await mountSuspended(ReportTable, {
      ...mountOptions,
      props: { rows: [], columns: [], total: 0, pageSize: 20, loading: true },
    })
    expect(loading.get('[role="status"]').text()).toContain('Loading report')

    const empty = await mountSuspended(ReportTable, {
      ...mountOptions,
      props: { rows: [], columns: [], total: 0, pageSize: 20 },
    })
    expect(empty.text()).toContain('No report records match')

    const error = await mountSuspended(ReportTable, {
      ...mountOptions,
      props: {
        rows: [],
        columns: [],
        total: 0,
        pageSize: 20,
        error: 'Network unavailable',
      },
    })
    expect(error.get('[role="alert"]').text()).toContain('Network unavailable')
  })
})
