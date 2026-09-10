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

  it('has a RouterLink to /login labelled «Войти» in the header', async () => {
    const wrapper = await mountLanding()
    const headerLink = wrapper
      .findAllComponents(RouterLink)
      .find((link) => link.props('to') === '/login' && link.text() === 'Войти')
    expect(headerLink).toBeDefined()
  })

  it('renders a hero section with a heading', async () => {
    const wrapper = await mountLanding()
    const hero = wrapper.find('[data-section="hero"]')
    expect(hero.exists()).toBe(true)
    expect(hero.find('h1').text().length).toBeGreaterThan(0)
  })

  it('has a second «Войти в личный кабинет» link to /login in the hero', async () => {
    const wrapper = await mountLanding()
    const hero = wrapper.find('[data-section="hero"]')
    const heroLoginLink = hero.find('a[href="/login"]')
    expect(heroLoginLink.exists()).toBe(true)
    expect(heroLoginLink.text()).toContain('Войти в личный кабинет')
  })

  it('renders at least 4 feature cards in the features section', async () => {
    const wrapper = await mountLanding()
    const features = wrapper.find('[data-section="features"]')
    expect(features.exists()).toBe(true)
    expect(features.findAll('[data-card]').length).toBeGreaterThanOrEqual(4)
  })

  it('renders exactly 4 numbered steps in the how-it-works section', async () => {
    const wrapper = await mountLanding()
    const how = wrapper.find('[data-section="how-it-works"]')
    expect(how.exists()).toBe(true)
    expect(how.findAll('ol > li')).toHaveLength(4)
  })

  it('renders a footer with «© 2026 OpsPilot»', async () => {
    const wrapper = await mountLanding()
    const footer = wrapper.find('footer')
    expect(footer.exists()).toBe(true)
    expect(footer.text()).toContain('© 2026 OpsPilot')
  })

  it('footer has placeholder links', async () => {
    const wrapper = await mountLanding()
    const footer = wrapper.find('footer')
    expect(footer.findAll('a[href="#"]').length).toBeGreaterThan(0)
  })
})
