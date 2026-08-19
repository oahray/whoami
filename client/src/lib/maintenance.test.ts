import { describe, expect, it } from 'vitest'
import {
  formatMaintenanceCountdown,
  getMaintenanceCountdownTarget,
  maintenancePollIntervalMs,
  MAINTENANCE_POLL_ACTIVE_MS,
  MAINTENANCE_POLL_IDLE_MS
} from './maintenance'

describe('maintenance countdown', () => {
  const now = new Date('2026-06-09T14:00:00.000Z').getTime()

  it('targets startsAt during upcoming phase', () => {
    expect(
      getMaintenanceCountdownTarget({
        phase: 'upcoming',
        startsAt: '2026-06-09T15:00:00.000Z',
        endsAt: '2026-06-09T16:00:00.000Z'
      })
    ).toBe('2026-06-09T15:00:00.000Z')
  })

  it('targets endsAt during freeze and active', () => {
    const status = {
      phase: 'active' as const,
      startsAt: '2026-06-09T13:00:00.000Z',
      endsAt: '2026-06-09T15:30:00.000Z'
    }
    expect(getMaintenanceCountdownTarget(status)).toBe('2026-06-09T15:30:00.000Z')
  })

  it('formats remaining time at different scales', () => {
    expect(formatMaintenanceCountdown('2026-06-09T15:30:00.000Z', now)).toBe('1h 30m')
    expect(formatMaintenanceCountdown('2026-06-09T14:02:30.000Z', now)).toBe('2m 30s')
    expect(formatMaintenanceCountdown('2026-06-09T14:00:45.000Z', now)).toBe('45s')
    expect(formatMaintenanceCountdown('2026-06-09T14:00:00.000Z', now)).toBe('any moment now')
  })

  it('polls slowly when idle and every 15s when a window is live', () => {
    expect(maintenancePollIntervalMs('none')).toBe(MAINTENANCE_POLL_IDLE_MS)
    expect(maintenancePollIntervalMs('upcoming')).toBe(MAINTENANCE_POLL_ACTIVE_MS)
    expect(maintenancePollIntervalMs('freeze')).toBe(MAINTENANCE_POLL_ACTIVE_MS)
    expect(maintenancePollIntervalMs('active')).toBe(MAINTENANCE_POLL_ACTIVE_MS)
  })
})
