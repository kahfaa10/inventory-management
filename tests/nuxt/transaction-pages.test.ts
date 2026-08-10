import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '../../app/components/AppSidebar.vue'
import AdjustmentInForm from '../../app/components/transactions/AdjustmentInForm.vue'
import StockReleaseForm from '../../app/components/transactions/StockReleaseForm.vue'
import StockReturnForm from '../../app/components/transactions/StockReturnForm.vue'
import TransactionActions from '../../app/components/transactions/TransactionActions.vue'
import TransactionReviewModal from '../../app/components/transactions/TransactionReviewModal.vue'
import AdjustmentDetailPage from '../../app/pages/transactions/stock-adjustment-ins/[id].vue'
import AdjustmentListPage from '../../app/pages/transactions/stock-adjustment-ins/index.vue'
import AdjustmentNewPage from '../../app/pages/transactions/stock-adjustment-ins/new.vue'
import ReleaseDetailPage from '../../app/pages/transactions/stock-releases/[id].vue'
import ReleaseListPage from '../../app/pages/transactions/stock-releases/index.vue'
import ReleaseNewPage from '../../app/pages/transactions/stock-releases/new.vue'
import ReturnDetailPage from '../../app/pages/transactions/stock-returns/[id].vue'
import ReturnListPage from '../../app/pages/transactions/stock-returns/index.vue'
import ReturnNewPage from '../../app/pages/transactions/stock-returns/new.vue'

const mocks = vi.hoisted(() => ({
  role: 'ADMIN' as 'ADMIN' | 'USER',
  routeId: '1',
  request: vi.fn(),
  navigateTo: vi.fn(),
  refresh: vi.fn(),
}))

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ id: '1', email: 'admin@example.com', name: 'Administrator', role: mocks.role }),
  fetch: vi.fn(),
  clear: vi.fn(),
}))

mockNuxtImport('useRoute', () => () => ({ params: { id: mocks.routeId } }))
mockNuxtImport('navigateTo', () => mocks.navigateTo)
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport('useFetch', () => () => ({
  data: ref({ data: [], page: 1, pageSize: 20, total: 0 }),
  pending: ref(false),
  error: ref(null),
  refresh: mocks.refresh,
}))
mockNuxtImport('useAsyncData', () => (_key: string, loader?: () => Promise<unknown>) => ({
  data: ref(null),
  pending: ref(false),
  error: ref(null),
  refresh: loader ? vi.fn(loader) : mocks.refresh,
}))

const uiStubs = {
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert">{{ title }} {{ description }}<slot /></div>',
  },
  UBadge: { template: '<span><slot /></span>' },
  UButton: {
    inheritAttrs: false,
    props: ['label', 'disabled', 'to'],
    emits: ['click'],
    template:
      '<button v-bind="$attrs" :disabled="disabled" :data-to="to" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UCard: { template: '<div><slot /><slot name="header" /></div>' },
  UForm: {
    emits: ['submit'],
    template: '<form @submit.prevent="$emit(\'submit\', {})"><slot /></form>',
  },
  UFormField: {
    props: ['label', 'error', 'name'],
    template:
      '<label :data-name="name">{{ label }}<slot /><span v-if="error" role="alert">{{ error }}</span></label>',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue', 'disabled', 'type'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :type="type" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UModal: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="review-modal"><slot name="body" /></div>',
  },
  USelect: {
    inheritAttrs: false,
    props: ['modelValue', 'items', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<select v-bind="$attrs" :disabled="disabled" :value="modelValue ?? \'\'" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value ?? \'\'">{{ item.label }}</option></select>',
  },
  UTable: {
    props: ['columns', 'data'],
    template:
      '<table><thead><tr><th v-for="column in columns" :key="column.id || column.accessorKey">{{ column.header }}</th></tr></thead><tbody><tr v-if="!data?.length"><td><slot name="empty" /></td></tr></tbody></table>',
  },
  UTextarea: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<textarea :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UPagination: { template: '<nav aria-label="Pagination" />' },
}

const mountOptions = { route: '/', global: { stubs: uiStubs } }

const device = { id: '10', deviceName: 'Disk', isActive: true }
const devices = [device]
const deviceDetail = {
  id: '11',
  deviceId: '10',
  partNumber: 'PN-1',
  dpn: null,
  specification: '600GB',
  isActive: true,
  device,
}
const deviceDetails = [deviceDetail]
const rack = { id: '20', rackCode: 'A', rackName: 'Rack A', isActive: true }
const racks = [rack]
const customer = { id: '30', customerName: 'ACME', isActive: true }
const customers = [customer]

beforeEach(() => {
  mocks.role = 'ADMIN'
  mocks.request.mockReset().mockResolvedValue({ balance: 7 })
  mocks.navigateTo.mockReset().mockResolvedValue(undefined)
  mocks.refresh.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('$fetch', mocks.request)
})

describe('transaction pages and shared behavior', () => {
  it('links all three transaction modules from the application navigation', async () => {
    const wrapper = await mountSuspended(AppSidebar, mountOptions)
    expect(wrapper.get('[data-to="/transactions/stock-adjustment-ins"]').text()).toContain(
      'Stock Adjustment In',
    )
    expect(wrapper.get('[data-to="/transactions/stock-releases"]').text()).toContain(
      'Stock Releases',
    )
    expect(wrapper.get('[data-to="/transactions/stock-returns"]').text()).toContain('Stock Returns')
  })

  it('renders all nine transaction route modules', async () => {
    for (const [page, title] of [
      [AdjustmentListPage, 'Stock Adjustment In'],
      [AdjustmentNewPage, 'New Stock Adjustment In'],
      [AdjustmentDetailPage, 'Stock Adjustment In'],
      [ReleaseListPage, 'Stock Releases'],
      [ReleaseNewPage, 'New Stock Release'],
      [ReleaseDetailPage, 'Stock Release'],
      [ReturnListPage, 'Stock Returns'],
      [ReturnNewPage, 'New Stock Return'],
      [ReturnDetailPage, 'Stock Return'],
    ] as const) {
      const wrapper = await mountSuspended(page, mountOptions)
      expect(wrapper.text()).toContain(title)
    }
  })

  it('shows draft actions, hides edits after completion, and limits cancellation to Admin', async () => {
    const draft = await mountSuspended(TransactionActions, {
      ...mountOptions,
      props: { status: 'DRAFT' },
    })
    expect(draft.text()).toContain('Edit')
    expect(draft.text()).toContain('Complete')
    expect(draft.text()).toContain('Cancel')

    mocks.role = 'USER'
    const completed = await mountSuspended(TransactionActions, {
      ...mountOptions,
      props: { status: 'COMPLETED' },
    })
    expect(completed.text()).not.toContain('Edit')
    expect(completed.text()).not.toContain('Complete')
    expect(completed.text()).not.toContain('Cancel')
  })

  it('opens a confirmation modal before completion', async () => {
    const wrapper = await mountSuspended(TransactionReviewModal, {
      ...mountOptions,
      props: { open: true, action: 'complete', transactionNumber: 'SAI-202608-0001' },
    })
    expect(wrapper.text()).toContain('Complete transaction?')
    expect(wrapper.text()).toContain('SAI-202608-0001')
    await wrapper.get('button[data-action="confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('keeps draft adjustment rows editable and renders server field errors beside inputs', async () => {
    const wrapper = await mountSuspended(AdjustmentInForm, {
      ...mountOptions,
      props: {
        modelValue: {
          transactionDate: '2026-08-10',
          customerId: null,
          notes: '',
          details: [
            {
              key: 'row-1',
              deviceId: '10',
              deviceDetailId: '11',
              destinationRackId: '20',
              quantity: 1,
              notes: '',
            },
          ],
        },
        editable: true,
        devices,
        deviceDetails,
        racks,
        customers,
        fieldErrors: { 'details.0.quantity': ['Quantity exceeds the allowed value.'] },
      },
    })
    expect(wrapper.text()).toContain('Quantity exceeds the allowed value.')
    expect(wrapper.find('button[aria-label="Remove detail row 1"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Add detail row"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()

    await wrapper.setProps({ editable: false })
    expect(wrapper.find('button[aria-label="Add detail row"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Remove detail row 1"]').exists()).toBe(false)
  })

  it('refreshes release availability only after Device Detail and Rack are selected', async () => {
    const wrapper = await mountSuspended(StockReleaseForm, {
      ...mountOptions,
      props: {
        modelValue: {
          releaseDate: '2026-08-10',
          engineerName: 'Engineer',
          customerId: '30',
          modelId: null,
          serviceTagId: null,
          referenceNumber: '',
          notes: '',
          details: [
            {
              key: 'row-1',
              deviceId: '10',
              deviceDetailId: '',
              sourceRackId: '',
              releasedQuantity: 1,
              notes: '',
            },
          ],
        },
        editable: true,
        devices,
        deviceDetails,
        racks,
        customers,
        models: [],
        serviceTags: [],
      },
    })

    expect(mocks.request).not.toHaveBeenCalledWith('/api/stock/balance', expect.anything())
    await wrapper.get('[aria-label="Device Detail row 1"]').setValue('11')
    await flushPromises()
    expect(mocks.request).not.toHaveBeenCalledWith('/api/stock/balance', expect.anything())
    await wrapper.get('[aria-label="Source Rack row 1"]').setValue('20')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('/api/stock/balance', {
      query: { deviceDetailId: '11', rackId: '20' },
    })
    expect(wrapper.text()).toContain('Available: 7')
  })

  it('filters Service Tags to the exact selected Model and Customer relationship', async () => {
    const wrapper = await mountSuspended(StockReleaseForm, {
      ...mountOptions,
      props: {
        modelValue: {
          releaseDate: '2026-08-10',
          engineerName: 'Engineer',
          customerId: '30',
          modelId: '40',
          serviceTagId: null,
          referenceNumber: '',
          notes: '',
          details: [],
        },
        editable: true,
        devices,
        deviceDetails,
        racks,
        customers,
        models: [{ id: '40', modelName: 'R760', isActive: true }],
        serviceTags: [
          { id: '50', serviceTag: 'MATCH', modelId: '40', customerId: '30', isActive: true },
          {
            id: '51',
            serviceTag: 'WRONG-CUSTOMER',
            modelId: '40',
            customerId: '31',
            isActive: true,
          },
          { id: '52', serviceTag: 'WRONG-MODEL', modelId: '41', customerId: '30', isActive: true },
        ],
      },
    })
    expect(wrapper.get('[aria-label="Service Tag"]').text()).toContain('MATCH')
    expect(wrapper.get('[aria-label="Service Tag"]').text()).not.toContain('WRONG-CUSTOMER')
    expect(wrapper.get('[aria-label="Service Tag"]').text()).not.toContain('WRONG-MODEL')
  })

  it('shows eligible return quantities and inherited engineer/customer as read-only', async () => {
    const wrapper = await mountSuspended(StockReturnForm, {
      ...mountOptions,
      props: {
        modelValue: {
          returnDate: '2026-08-10',
          stockReleaseId: '60',
          notes: '',
          details: [
            {
              key: 'row-1',
              stockReleaseDetailId: '61',
              destinationRackId: '20',
              returnQuantity: 1,
              notes: '',
            },
          ],
        },
        editable: true,
        racks,
        eligibleReleases: [
          {
            id: '60',
            transactionNumber: 'SRL-202608-0001',
            releaseDate: '2026-08-09',
            engineerName: 'Inherited Engineer',
            customerId: '30',
            customer,
            details: [
              {
                stockReleaseDetailId: '61',
                deviceDetailId: '11',
                sourceRackId: '20',
                releasedQuantity: 5,
                completedReturnedQuantity: 2,
                remainingReturnableQuantity: 3,
                deviceDetail,
                sourceRack: rack,
              },
            ],
          },
        ],
      },
    })
    expect(wrapper.get('input[aria-label="Engineer Name"]').attributes('value')).toBe(
      'Inherited Engineer',
    )
    expect(wrapper.get('input[aria-label="Customer"]').attributes('value')).toBe('ACME')
    expect(wrapper.text()).toContain('Released: 5')
    expect(wrapper.text()).toContain('Previously returned: 2')
    expect(wrapper.text()).toContain('Remaining: 3')
    expect(wrapper.find('input[aria-label="Engineer Name"]').attributes('readonly')).toBeDefined()
    expect(wrapper.find('input[aria-label="Customer"]').attributes('readonly')).toBeDefined()
  })
})
