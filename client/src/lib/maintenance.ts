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

export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  const res = await fetch(`${API_BASE_URL}/maintenance/status`)
  if (!res.ok) {
    throw new Error('Failed to fetch maintenance status')
  }
  return res.json() as Promise<MaintenanceStatus>
}
