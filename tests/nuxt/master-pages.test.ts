import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AppSidebar from '../../app/components/AppSidebar.vue'
import MasterList from '../../app/components/masters/MasterList.vue'
import CustomersPage from '../../app/pages/master/customers.vue'
import DeviceDetailsPage from '../../app/pages/master/device-details.vue'
import DevicesPage from '../../app/pages/master/devices.vue'
import ModelsPage from '../../app/pages/master/models.vue'
import RacksPage from '../../app/pages/master/racks.vue'
import ServiceTagsPage from '../../app/pages/master/service-tags.vue'

const uiStubs = {
  UBadge: { template: '<span><slot /></span>' },
  UButton: {
    props: ['label'],
    template: '<button>{{ label }}<slot /></button>',
  },
  UCard: { template: '<div><slot /></div>' },
  UForm: { template: '<form><slot /></form>' },
  UFormField: {
    props: ['label'],
    template: '<label>{{ label }}<slot /></label>',
  },
  UInput: { template: '<input />' },
  UModal: { template: '<div><slot name="body" /></div>' },
  UPagination: { template: '<nav />' },
  USelect: {
    inheritAttrs: false,
    template: '<select v-bind="$attrs" />',
  },
  USwitch: { template: '<button role="switch" />' },
  UTable: {
    props: ['columns'],
    template:
      '<table><thead><tr><th v-for="column in columns" :key="column.id || column.accessorKey">{{ column.header }}</th></tr></thead><tbody><slot name="empty" /></tbody></table>',
  },
  UTextarea: { template: '<textarea />' },
}

const mountOptions = {
  route: '/',
  global: {
    stubs: uiStubs,
  },
}

const { currentUser, refresh } = vi.hoisted(() => ({
  currentUser: {
    id: '1',
    email: 'admin@example.com',
    name: 'Administrator',
    role: 'ADMIN' as const,
  },
  refresh: vi.fn(),
}))

mockNuxtImport('useUserSession', () => () => ({
  user: ref(currentUser),
  clear: vi.fn(),
  fetch: vi.fn(),
}))

mockNuxtImport('useFetch', () => () => ({
  data: ref({ data: [], page: 1, pageSize: 20, total: 0 }),
  pending: ref(false),
  refresh,
}))

mockNuxtImport('useToast', () => () => ({
  add: vi.fn(),
}))

describe('master navigation and pages', () => {
  it('shows all six master navigation entries', async () => {
    const wrapper = await mountSuspended(AppSidebar, mountOptions)
    for (const label of [
      'Models',
      'Service Tags',
      'Devices',
      'Device Details',
      'Customers',
      'Racks',
    ]) {
      expect(wrapper.text()).toContain(label)
    }
  })

  it.each([
    [ModelsPage, 'Models', ['Model Name', 'Description']],
    [ServiceTagsPage, 'Service Tags', ['Service Tag', 'Model', 'Customer']],
    [DevicesPage, 'Devices', ['Device Name', 'Description']],
    [DeviceDetailsPage, 'Device Details', ['Device', 'Part Number', 'DP/N', 'Specification']],
    [CustomersPage, 'Customers', ['Customer Name', 'Contact Person', 'Contact Number', 'Address']],
    [RacksPage, 'Racks', ['Rack Code', 'Rack Name', 'Description']],
  ])('renders the %s screen with resource-specific columns', async (page, title, columns) => {
    const wrapper = await mountSuspended(page, mountOptions)
    expect(wrapper.text()).toContain(title)
    for (const column of columns) {
      expect(wrapper.text()).toContain(column)
    }
  })

  it('provides dependent parent filters for service tags and device details', async () => {
    const tags = await mountSuspended(ServiceTagsPage, mountOptions)
    expect(tags.find('[aria-label="Filter by model"]').exists()).toBe(true)
    expect(tags.find('[aria-label="Filter by customer"]').exists()).toBe(true)

    const details = await mountSuspended(DeviceDetailsPage, mountOptions)
    expect(details.find('[aria-label="Filter by device"]').exists()).toBe(true)
  })

  it('hides create and edit controls from User role rendering', async () => {
    const wrapper = await mountSuspended(MasterList, {
      props: {
        rows: [{ id: '1', isActive: true }],
        columns: [{ accessorKey: 'id', header: 'ID' }],
        total: 1,
        pageSize: 20,
        canWrite: false,
      },
      ...mountOptions,
    })

    expect(wrapper.text()).not.toContain('Create')
    expect(wrapper.text()).not.toContain('Edit')
  })
})
