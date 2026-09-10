import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router'
import LandingView from '../LandingView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

async function mountLanding() {
  const router = makeRouter()
  router.push('/')
  await router.isReady()
  return mount(LandingView, {
    global: { plugins: [router] },
  })
}

describe('LandingView', () => {
  it('renders a header element', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('header').exists()).toBe(true)
  })

  it('shows the OpsPilot logo text', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('header').text()).toContain('OpsPilot')
  })

  it('has a RouterLink to /login labelled «Войти»', async () => {
    const wrapper = await mountLanding()
    const links = wrapper.findAllComponents(RouterLink)
    const loginLink = links.find((link) => link.props('to') === '/login')
    expect(loginLink).toBeDefined()
    expect(loginLink!.text()).toBe('Войти')
  })
})
