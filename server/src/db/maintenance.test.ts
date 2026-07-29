import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from './supabase.js'
import {
  canPurgeDataset,
  cancelMaintenanceWindow,
  getMaintenanceStatus,
  MaintenanceScheduleError,
  MAINTENANCE_FREEZE_LEAD_MS
} from './maintenance.js'
import { createQueryBuilder, hasEq, hasOp } from '../test-utils/supabaseQueryBuilder.js'

const NOW = new Date('2026-06-09T14:00:00.000Z').getTime()

function mockWindows(rows: Array<Record<string, unknown>>) {
  vi.mocked(supabase.from).mockImplementation((table: string) =>
    createQueryBuilder(table, () => {
      if (table === 'maintenance_windows') {
        return { data: rows, error: null }
      }
      return { error: new Error(`Unexpected table ${table}`) }
    })
  )
}

describe('maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns none when no windows are active', async () => {
    mockWindows([])
    await expect(getMaintenanceStatus(NOW)).resolves.toEqual({
      phase: 'none',
      endsAt: null,
      startsAt: null
    })
  })

  it('returns upcoming within 24 hours before starts_at', async () => {
    const startsAt = new Date(NOW + 12 * 60 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 13 * 60 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }])

    await expect(getMaintenanceStatus(NOW)).resolves.toEqual({
      phase: 'upcoming',
      endsAt,
      startsAt
    })
  })

  it('returns freeze during the 15-minute lead time', async () => {
    const startsAt = new Date(NOW + 10 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 40 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }])

    await expect(getMaintenanceStatus(NOW)).resolves.toEqual({
      phase: 'freeze',
      endsAt,
      startsAt
    })
  })

  it('returns active between starts_at and ends_at', async () => {
    const startsAt = new Date(NOW - 5 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 25 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }])

    await expect(getMaintenanceStatus(NOW)).resolves.toEqual({
      phase: 'active',
      endsAt,
      startsAt
    })
  })

  it('uses a 15-minute freeze lead constant', () => {
    expect(MAINTENANCE_FREEZE_LEAD_MS).toBe(15 * 60 * 1000)
  })

  it('allows purge for any dataset during a global active window', async () => {
    const startsAt = new Date(NOW - 5 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 25 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }])

    await expect(canPurgeDataset('ds-1', NOW)).resolves.toBe(true)
  })

  it('allows purge only for the scoped dataset during a dataset window', async () => {
    const startsAt = new Date(NOW - 5 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 25 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: 'ds-1' }])

    await expect(canPurgeDataset('ds-1', NOW)).resolves.toBe(true)
    await expect(canPurgeDataset('ds-2', NOW)).resolves.toBe(false)
  })

  it('does not allow purge during freeze-only phase', async () => {
    const startsAt = new Date(NOW + 10 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 40 * 60 * 1000).toISOString()
    mockWindows([{ id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }])

    await expect(canPurgeDataset('ds-1', NOW)).resolves.toBe(false)
  })

  it('allows ending a window early during freeze', async () => {
    const startsAt = new Date(NOW + 10 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 40 * 60 * 1000).toISOString()
    const row = { id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }
    let deleted = false

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table !== 'maintenance_windows') {
          return { error: new Error(`Unexpected table ${table}`) }
        }
        if (hasOp(state, 'delete') && hasEq(state, 'id', 'mw-1')) {
          deleted = true
          return { data: null, error: null }
        }
        if (hasOp(state, 'maybeSingle') || hasOp(state, 'select')) {
          return { data: row, error: null }
        }
        return { data: null, error: null }
      })
    )

    await expect(cancelMaintenanceWindow('mw-1', NOW)).resolves.toBeUndefined()
    expect(deleted).toBe(true)
  })

  it('allows ending a window early while active', async () => {
    const startsAt = new Date(NOW - 5 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW + 25 * 60 * 1000).toISOString()
    const row = { id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }
    let deleted = false

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table !== 'maintenance_windows') {
          return { error: new Error(`Unexpected table ${table}`) }
        }
        if (hasOp(state, 'delete') && hasEq(state, 'id', 'mw-1')) {
          deleted = true
          return { data: null, error: null }
        }
        return { data: row, error: null }
      })
    )

    await expect(cancelMaintenanceWindow('mw-1', NOW)).resolves.toBeUndefined()
    expect(deleted).toBe(true)
  })

  it('rejects ending a window that already finished', async () => {
    const startsAt = new Date(NOW - 40 * 60 * 1000).toISOString()
    const endsAt = new Date(NOW - 10 * 60 * 1000).toISOString()
    const row = { id: 'mw-1', starts_at: startsAt, ends_at: endsAt, dataset_id: null }

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => {
        if (table !== 'maintenance_windows') {
          return { error: new Error(`Unexpected table ${table}`) }
        }
        return { data: row, error: null }
      })
    )

    await expect(cancelMaintenanceWindow('mw-1', NOW)).rejects.toMatchObject({
      code: 'ALREADY_ENDED'
    } satisfies Partial<MaintenanceScheduleError>)
  })
})
