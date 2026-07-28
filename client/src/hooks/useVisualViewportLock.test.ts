import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisualViewportLock } from './useVisualViewportLock'

describe('useVisualViewportLock', () => {
  const listeners = new Map<string, Set<() => void>>()

  beforeEach(() => {
    listeners.clear()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 500,
        offsetTop: 40,
        addEventListener: (type: string, handler: () => void) => {
          if (!listeners.has(type)) listeners.set(type, new Set())
          listeners.get(type)!.add(handler)
        },
        removeEventListener: (type: string, handler: () => void) => {
          listeners.get(type)?.delete(handler)
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('locks the shell to the visual viewport on small screens', () => {
    const { result } = renderHook(() => useVisualViewportLock())
    expect(result.current).toMatchObject({
      position: 'fixed',
      top: 40,
      height: 500
    })
  })

  it('updates when the visual viewport resizes', () => {
    const { result } = renderHook(() => useVisualViewportLock())
    const viewport = window.visualViewport as {
      height: number
      offsetTop: number
    }

    act(() => {
      viewport.height = 450
      viewport.offsetTop = 60
      listeners.get('resize')?.forEach((handler) => handler())
    })

    expect(result.current).toMatchObject({
      top: 60,
      height: 450
    })
  })
})
