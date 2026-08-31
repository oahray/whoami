import { API_BASE_URL } from './apiBase'

export type MaintenancePhase = 'none' | 'upcoming' | 'freeze' | 'active'

export interface MaintenanceStatus {
  phase: MaintenancePhase
  endsAt: string | null
  startsAt: string | null
}

export const MAINTENANCE_COPY: Record<Exclude<MaintenancePhase, 'none'>, string> = {
  upcoming:
    'Maintenance is scheduled soon. New games may be paused briefly while we update content.',
  freeze:
    'New games are paused briefly while we prepare an update. You can finish games already in progress.',
  active: "We're updating content. New games will be back soon."
}

export const MAINTENANCE_SOLO_ENDED_COPY =
  'This run ended because content is updating. Your score so far is saved.'

export const MAINTENANCE_PASS_PLAY_STUCK_COPY =
  "Can't load the next card while content is updating. You can keep this card or go back to setup."

export const MAINTENANCE_NEW_DECK_COPY = 'New decks are paused until maintenance ends.'

/** While a window is upcoming/freeze/active (live game screens). */
export const MAINTENANCE_POLL_ACTIVE_MS = 15_000
/** When nothing is scheduled. */
export const MAINTENANCE_POLL_IDLE_MS = 3 * 60 * 1000

export function maintenancePollIntervalMs(phase: MaintenancePhase): number {
  return phase === 'none' ? MAINTENANCE_POLL_IDLE_MS : MAINTENANCE_POLL_ACTIVE_MS
}

export function isMaintenanceBlockingNewGames(status: MaintenanceStatus | null | undefined): boolean {
  return status?.phase === 'freeze' || status?.phase === 'active'
}

/** Local date/time with 12-hour clock (e.g. "Jun 9, 2:30 PM"). */
export function formatMaintenanceDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/** ISO timestamp the countdown should target for the current maintenance phase. */
export function getMaintenanceCountdownTarget(status: MaintenanceStatus): string | null {
  if (status.phase === 'upcoming') return status.startsAt
  if (status.phase === 'freeze' || status.phase === 'active') return status.endsAt
  return null
}

/** Human-readable time remaining (e.g. "2h 15m", "45s"). */
export function formatMaintenanceCountdown(targetIso: string, now = Date.now()): string {
  const ms = Math.max(0, new Date(targetIso).getTime() - now)
  if (ms === 0) return 'any moment now'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  const res = await fetch(`${API_BASE_URL}/maintenance/status`)
  if (!res.ok) {
    throw new Error('Failed to fetch maintenance status')
  }
  return res.json() as Promise<MaintenanceStatus>
}
