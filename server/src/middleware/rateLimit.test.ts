import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimit.js'

describe('createRateLimiter', () => {
  it('allows up to the limit in a window, then asks the caller to wait', () => {
    let time = 0
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 }, () => time)
    expect([1, 2, 3].map(() => limiter.hit('1.2.3.4').allowed)).toEqual([true, true, true])
    time = 20_000
    expect(limiter.hit('1.2.3.4')).toEqual({ allowed: false, retryAfterMs: 40_000 })
  })

  it('counts each address separately', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 }, () => 0)
    expect(limiter.hit('a').allowed).toBe(true)
    expect(limiter.hit('b').allowed).toBe(true)
    expect(limiter.hit('a').allowed).toBe(false)
  })

  it('starts a fresh window once the old one ends', () => {
    let time = 0
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 }, () => time)
    limiter.hit('a')
    expect(limiter.hit('a').allowed).toBe(false)
    time = 60_000
    expect(limiter.hit('a').allowed).toBe(true)
  })

  it('forgets addresses from old windows so a flood cannot grow memory forever', () => {
    let time = 0
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 }, () => time)
    for (let i = 0; i < 1000; i += 1) limiter.hit(`10.0.${Math.floor(i / 256)}.${i % 256}`)
    expect(limiter.size()).toBe(1000)
    time = 61_000
    limiter.hit('fresh')
    expect(limiter.size()).toBe(1)
  })
})
