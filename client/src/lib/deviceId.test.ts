import { beforeEach, describe, expect, it } from 'vitest'
import { getDeviceId } from './deviceId'

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates an id in the format the server accepts and reuses it', () => {
    const first = getDeviceId()
    expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(getDeviceId()).toBe(first)
    expect(localStorage.getItem('whoami_device_id')).toBe(first)
  })

  it('replaces a malformed stored value', () => {
    localStorage.setItem('whoami_device_id', 'bad id!')
    const id = getDeviceId()
    expect(id).not.toBe('bad id!')
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})
