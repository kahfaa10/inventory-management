import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '../../app/components/AppSidebar.vue'
import DefaultLayout from '../../app/layouts/default.vue'
import LoginPage from '../../app/pages/login.vue'
import CustomersPage from '../../app/pages/master/customers.vue'
import DeviceDetailsPage from '../../app/pages/master/device-details.vue'
import DevicesPage from '../../app/pages/master/devices.vue'
import ModelsPage from '../../app/pages/master/models.vue'
import RacksPage from '../../app/pages/master/racks.vue'
import ServiceTagsPage from '../../app/pages/master/service-tags.vue'

const mocks = vi.hoisted(() => ({
  sessionUser: {
    id: '1',
    email: 'admin@example.com',
    name: 'Administrator',
    role: 'ADMIN' as 'ADMIN' | 'USER',
  },
  listResponse: { data: [] as Record<string, unknown>[], page: 1, pageSize: 20, total: 0 },
  activeOptions: {
    '/api/models': [] as Record<string, unknown>[],
    '/api/customers': [] as Record<string, unknown>[],
    '/api/devices': [] as Record<string, unknown>[],
  },
  optionErrors: new Set<string>(),
  fetchQueries: [] as { endpoint: string; query: { value: Record<string, unknown> } }[],
  refresh: vi.fn(),
  request: vi.fn(),
  clear: vi.fn(),
  navigateTo: vi.fn(),
}))

mockNuxtImport('useUserSession', () => () => ({
  user: { value: mocks.sessionUser },
  clear: mocks.clear,
  fetch: vi.fn(),
}))

mockNuxtImport('useFetch', () => (endpoint: string, options: { query: never }) => {
  mocks.fetchQueries.push({
    endpoint,
    query: options.query as unknown as { value: Record<string, unknown> },
  })
  return {
    data: ref(mocks.listResponse),
    pending: ref(false),
    refresh: mocks.refresh,
  }
})

mockNuxtImport('useAsyncData', () => (key: string) => {
  const endpoint = key.replace('active-master-options:', '') as keyof typeof mocks.activeOptions
  return {
    data: ref(mocks.activeOptions[endpoint] ?? []),
    pending: ref(false),
    error: ref(mocks.optionErrors.has(endpoint) ? new Error('option load failed') : null),
    refresh: vi.fn(),
  }
})

mockNuxtImport('useToast', () => () => ({
  add: vi.fn(),
}))

mockNuxtImport('navigateTo', () => mocks.navigateTo)

const uiStubs = {
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert">{{ title }} {{ description }}</div>',
  },
  UBadge: { template: '<span><slot /></span>' },
  UButton: {
    inheritAttrs: false,
    props: ['label', 'to'],
    emits: ['click'],
    template:
      '<button v-bind="$attrs" :data-to="to" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UCard: { template: '<div><slot /><slot name="header" /></div>' },
  UForm: {
    emits: ['submit'],
    template: '<form @submit.prevent="$emit(\'submit\', {})"><slot /></form>',
  },
  UFormField: {
    props: ['label'],
    template: '<label>{{ label }}<slot /></label>',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UModal: {
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="modal"><slot name="body" /></div>',
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
      '<select v-bind="$attrs" :value="modelValue ?? \'\'" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value ?? \'\'">{{ item.label }}</option></select>',
  },
  USlideover: {
    props: ['open'],
    emits: ['update:open'],
    template:
      '<div v-if="open" data-testid="mobile-navigation"><slot name="body" /><button aria-label="Close navigation" @click="$emit(\'update:open\', false)">Close</button></div>',
  },
  USwitch: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<button v-bind="$attrs" role="switch" @click="$emit(\'update:modelValue\', !modelValue)" />',
  },
  UTable: {
    props: ['columns', 'data'],
    template:
      '<table><thead><tr><th v-for="column in columns" :key="column.id || column.accessorKey">{{ column.header }}</th></tr></thead><tbody><tr v-for="item in data" :key="item.id"><td v-if="columns.some((column) => column.id === \'actions\')"><slot name="actions-cell" :row="{ original: item }" /></td></tr><tr v-if="!data?.length"><td><slot name="empty" /></td></tr></tbody></table>',
  },
  UTextarea: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

const mountOptions = {
  route: '/',
  global: {
    stubs: uiStubs,
  },
}

beforeEach(() => {
  mocks.sessionUser.role = 'ADMIN'
  Object.assign(mocks.listResponse, { data: [], page: 1, pageSize: 20, total: 0 })
  mocks.activeOptions['/api/models'] = []
  mocks.activeOptions['/api/customers'] = []
  mocks.activeOptions['/api/devices'] = []
  mocks.optionErrors.clear()
  mocks.fetchQueries.length = 0
  mocks.refresh.mockReset()
  mocks.request.mockReset().mockResolvedValue({})
  mocks.clear.mockReset().mockResolvedValue(undefined)
  mocks.navigateTo.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('$fetch', mocks.request)
})

describe('master navigation and pages', () => {
  it('shows only the six approved master navigation entries', async () => {
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
    expect(wrapper.text()).not.toContain('Purchase Orders')
  })

  it('opens accessible module navigation below lg, closes it, and supports logout', async () => {
    const wrapper = await mountSuspended(DefaultLayout, mountOptions)
    const toggle = wrapper.get('[aria-label="Open navigation"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')

    const mobile = wrapper.get('[data-testid="mobile-navigation"]')
    expect(mobile.text()).toContain('Service Tags')
    expect(mobile.text()).toContain('Sign out')
    await mobile.get('[data-to="/master/service-tags"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-navigation"]').exists()).toBe(false)

    await toggle.trigger('click')
    await wrapper
      .get('[data-testid="mobile-navigation"]')
      .get('button[aria-label="Close navigation"]')
      .trigger('click')
    expect(wrapper.find('[data-testid="mobile-navigation"]').exists()).toBe(false)

    await toggle.trigger('click')
    await wrapper
      .get('[data-testid="mobile-navigation"]')
      .findAll('button')
      .find((button) => button.text() === 'Sign out')!
      .trigger('click')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(mocks.navigateTo).toHaveBeenCalledWith('/login')
  })

  it('renders the login component without authenticated-layout content', async () => {
    const wrapper = await mountSuspended(LoginPage, mountOptions)
    expect(wrapper.text()).toContain('Sign in with your internal account.')
    expect(wrapper.text()).not.toContain('Internal use')
    expect(wrapper.text()).not.toContain('Service Tags')
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

  it('derives write controls from the mocked User session', async () => {
    mocks.sessionUser.role = 'USER'
    mocks.listResponse.data = [{ id: '1', modelName: 'Read only', isActive: true }]
    mocks.listResponse.total = 1

    const wrapper = await mountSuspended(ModelsPage, mountOptions)

    expect(wrapper.text()).not.toContain('Create')
    expect(wrapper.text()).not.toContain('Edit')
    expect(wrapper.find('[aria-label="Set inactive"]').exists()).toBe(false)
  })

  it('sends create, edit, and active-toggle payloads from a master page', async () => {
    mocks.listResponse.data = [{ id: '1', modelName: 'Original', isActive: true }]
    mocks.listResponse.total = 1
    const wrapper = await mountSuspended(ModelsPage, mountOptions)

    await wrapper.get('[aria-label="Set inactive"]').trigger('click')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('/api/models/1', {
      method: 'PUT',
      body: { isActive: false },
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Create')!
      .trigger('click')
    await wrapper.get('[data-testid="modal"] label input').setValue('New Model')
    await wrapper.get('[data-testid="modal"] form').trigger('submit')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('/api/models', {
      method: 'POST',
      body: { modelName: 'New Model', description: '', isActive: true },
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')!
      .trigger('click')
    await wrapper.get('[data-testid="modal"] label input').setValue('Updated Model')
    await wrapper.get('[data-testid="modal"] form').trigger('submit')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('/api/models/1', {
      method: 'PUT',
      body: { modelName: 'Updated Model', description: '', isActive: true },
    })
  })

  it('resets pagination when search, status, or a parent filter changes', async () => {
    mocks.listResponse.total = 45
    mocks.activeOptions['/api/models'] = [
      {
        id: '10',
        modelName: 'PowerEdge',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        description: null,
      },
    ]
    const wrapper = await mountSuspended(ServiceTagsPage, mountOptions)
    const query = mocks.fetchQueries.find((call) => call.endpoint === '/api/service-tags')!.query
    const nextPage = wrapper.get('[aria-label="Next page"]')

    await nextPage.trigger('click')
    expect(query.value.page).toBe(2)
    await wrapper.get('input[placeholder="Search"]').setValue('tag')
    expect(query.value.page).toBe(1)

    await nextPage.trigger('click')
    await wrapper.get('select').setValue('false')
    expect(query.value.page).toBe(1)

    await nextPage.trigger('click')
    await wrapper.get('[aria-label="Filter by model"]').setValue('10')
    expect(query.value.page).toBe(1)
    expect(query.value).toMatchObject({ modelId: '10' })
  })

  it('keeps filters active-only while retaining an inactive historical parent when editing', async () => {
    mocks.activeOptions['/api/models'] = [
      {
        id: '1',
        modelName: 'Active Model',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        description: null,
      },
    ]
    mocks.listResponse.data = [
      {
        id: '50',
        modelId: '999',
        customerId: null,
        serviceTag: 'HIST-1',
        description: null,
        isActive: true,
        createdAt: '',
        updatedAt: '',
        model: { id: '999', modelName: 'Retired Model', isActive: false },
        customer: null,
      },
    ]
    mocks.listResponse.total = 1
    const wrapper = await mountSuspended(ServiceTagsPage, mountOptions)

    const filterValues = wrapper
      .get('[aria-label="Filter by model"]')
      .findAll('option')
      .map((option) => option.attributes('value'))
    expect(filterValues).toEqual(['', '1'])

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')!
      .trigger('click')
    expect(wrapper.get('[data-testid="modal"]').text()).toContain('Retired Model (Inactive)')
  })

  it('renders option-loading failures and disables dependent filters', async () => {
    mocks.optionErrors.add('/api/devices')
    const wrapper = await mountSuspended(DeviceDetailsPage, mountOptions)

    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to load active Device options')
    expect(wrapper.get('[aria-label="Filter by device"]').attributes()).toHaveProperty('disabled')
  })
})
