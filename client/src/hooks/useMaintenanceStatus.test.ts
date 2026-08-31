import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMaintenanceStatus } from './useMaintenanceStatus'
import { MAINTENANCE_POLL_ACTIVE_MS, MAINTENANCE_POLL_IDLE_MS } from '../lib/maintenance'

describe('useMaintenanceStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
      } as Response)
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not poll when poll is off', async () => {
    const { unmount } = renderHook(() => useMaintenanceStatus())
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_POLL_IDLE_MS)
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('polls on the idle interval when phase is none', async () => {
    const { unmount } = renderHook(() => useMaintenanceStatus({ poll: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_POLL_ACTIVE_MS)
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_POLL_IDLE_MS)
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('polls every 15s once a window is upcoming', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          phase: 'upcoming',
          startsAt: '2026-06-09T15:00:00.000Z',
          endsAt: '2026-06-09T16:00:00.000Z'
        })
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          phase: 'upcoming',
          startsAt: '2026-06-09T15:00:00.000Z',
          endsAt: '2026-06-09T16:00:00.000Z'
        })
      } as Response)

    const { unmount } = renderHook(() => useMaintenanceStatus({ poll: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_POLL_ACTIVE_MS)
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
  })
})
