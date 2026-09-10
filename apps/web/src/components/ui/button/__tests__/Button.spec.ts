import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Button, buttonVariants } from '../index'

describe('Button', () => {
  it('renders a <button> with the default slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Approve' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toBe('Approve')
  })

  it('applies Tailwind utility classes from buttonVariants', () => {
    const wrapper = mount(Button, {
      props: { variant: 'destructive', size: 'sm' },
      slots: { default: 'Reject' },
    })
    const cls = wrapper.attributes('class') ?? ''
    expect(cls).toContain('bg-destructive')
    expect(cls).toContain('h-8')
  })

  it('renders the child element when asChild is set', () => {
    const wrapper = mount(Button, {
      props: { asChild: true },
      slots: { default: '<a href="/tickets">Tickets</a>' },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('class')).toContain('inline-flex')
  })

  it('buttonVariants() returns a class string for a given variant/size', () => {
    expect(buttonVariants({ variant: 'outline', size: 'lg' })).toContain('h-10')
  })
})
