import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import HomeView from '../HomeView.vue'

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn<(url: string) => Promise<{ data: Record<string, unknown> }>>(),
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({ get: mockGet }),
  },
}))

function mountHome() {
  return mount(HomeView, {
    global: { plugins: [createPinia()] },
  })
}

describe('HomeView', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('renders the OpsPilot heading', () => {
    mockGet.mockResolvedValue({ data: { status: 'ok' } })
    const wrapper = mountHome()
    expect(wrapper.get('h1').text()).toBe('OpsPilot')
  })

  it('shows the loading state before the health call resolves', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Backend: checking…')
  })

  it('shows "Backend: available" when the health call resolves { status: "ok" }', async () => {
    mockGet.mockResolvedValue({ data: { status: 'ok' } })
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain('Backend: available')
    expect(wrapper.text()).not.toContain('Backend: unavailable')
  })

  it('shows "Backend: unavailable" when the health call rejects', async () => {
    mockGet.mockRejectedValue(new Error('network down'))
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain('Backend: unavailable')
  })

  it('shows "Backend: unavailable" when the health call resolves a non-ok status', async () => {
    mockGet.mockResolvedValue({ data: { status: 'degraded' } })
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain('Backend: unavailable')
  })
})
