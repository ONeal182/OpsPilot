import { describe, it, expect } from 'vitest'
import router from '../index'

describe('router', () => {
  it('maps / to the landing route', () => {
    const match = router.resolve('/')
    expect(match.name).toBe('landing')
  })

  it('maps /login to the login route', () => {
    const match = router.resolve('/login')
    expect(match.name).toBe('login')
  })

  it('has no route named home', () => {
    expect(router.hasRoute('home')).toBe(false)
  })
})
