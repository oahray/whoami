import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { useWakeLock } from './useWakeLock'

type FakeSentinel = {
  release: Mock<[], Promise<void>>
  addEventListener: (type: string, fn: () => void) => void
  fireRelease: () => void
}

function fakeSentinel(): FakeSentinel {
  let onRelease: (() => void) | null = null
  const sentinel: FakeSentinel = {
    release: vi.fn(async () => {
      onRelease?.()
    }),
    addEventListener: (_type, fn) => {
      onRelease = fn
    },
    fireRelease: () => onRelease?.()
  }
  return sentinel
}

describe('useWakeLock', () => {
  let request: Mock<[string], Promise<FakeSentinel>>
  let sentinels: FakeSentinel[]
  let visibility: DocumentVisibilityState

  beforeEach(() => {
    sentinels = []
    visibility = 'visible'
    request = vi.fn(async (_type: string) => {
      const sentinel = fakeSentinel()
      sentinels.push(sentinel)
      return sentinel
    })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  })

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock
  })

  it('holds the lock while active and releases it when turned off', async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } })
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')

    rerender({ active: false })
    expect(sentinels[0].release).toHaveBeenCalled()
  })

  it('takes the lock again when the page comes back into view', async () => {
    renderHook(() => useWakeLock(true))
    await act(async () => {})
    expect(request).toHaveBeenCalledTimes(1)

    visibility = 'hidden'
    sentinels[0].fireRelease()
    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does nothing when inactive', async () => {
    renderHook(() => useWakeLock(false))
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
  })

  it('survives a browser without wake lock support', async () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  })
})
