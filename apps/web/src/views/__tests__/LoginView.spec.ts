import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginView from '../LoginView.vue'

describe('LoginView', () => {
  it('renders the «Вход» heading', () => {
    const wrapper = mount(LoginView)
    expect(wrapper.get('h1').text()).toBe('Вход')
  })

  it('renders the «Скоро» placeholder text', () => {
    const wrapper = mount(LoginView)
    expect(wrapper.text()).toContain('Скоро')
  })
})
