import { supabase } from './supabase.js'

/** Lead time before `starts_at` when players see a maintenance heads-up (24 hours). */
export const MAINTENANCE_NOTICE_LEAD_MS = 24 * 60 * 60 * 1000

/** Lead time before `starts_at` when new games are blocked (15 minutes). */
export const MAINTENANCE_FREEZE_LEAD_MS = 15 * 60 * 1000

export type MaintenancePhase = 'none' | 'upcoming' | 'freeze' | 'active'

export interface MaintenanceWindow {
  id: string
  dataset_id: string | null
  starts_at: string
  ends_at: string
  admin_note: string | null
  created_by: string | null
  created_at: string
}

export interface MaintenanceStatus {
  phase: MaintenancePhase
  /** When the active maintenance window ends (freeze/active/upcoming). */
  endsAt: string | null
  /** When maintenance begins — shown during the upcoming heads-up. */
  startsAt: string | null
}

export interface MaintenanceBlock {
  code: 'MAINTENANCE_FREEZE' | 'MAINTENANCE_ACTIVE'
  message: string
  endsAt: string
}

export class MaintenanceScheduleError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_RANGE'
      | 'STARTS_TOO_SOON'
      | 'OVERLAPPING_WINDOW'
      | 'NOT_FOUND'
      | 'CANNOT_CANCEL',
    message: string
  ) {
    super(message)
    this.name = 'MaintenanceScheduleError'
  }
}

function parseTime(iso: string): number {
  return new Date(iso).getTime()
}

function noticeStart(window: Pick<MaintenanceWindow, 'starts_at'>): number {
  return parseTime(window.starts_at) - MAINTENANCE_NOTICE_LEAD_MS
}

function freezeStart(window: Pick<MaintenanceWindow, 'starts_at'>): number {
  return parseTime(window.starts_at) - MAINTENANCE_FREEZE_LEAD_MS
}

function blockEnd(window: Pick<MaintenanceWindow, 'ends_at'>): number {
  return parseTime(window.ends_at)
}

function windowsOverlap(
  a: Pick<MaintenanceWindow, 'starts_at' | 'ends_at'>,
  b: Pick<MaintenanceWindow, 'starts_at' | 'ends_at'>
): boolean {
  return freezeStart(a) < blockEnd(b) && freezeStart(b) < blockEnd(a)
}

const PHASE_PRIORITY: Record<MaintenancePhase, number> = {
  none: 0,
  upcoming: 1,
  freeze: 2,
  active: 3
}

function phaseForWindow(window: MaintenanceWindow, now: number): MaintenancePhase {
  const noticeAt = noticeStart(window)
  const freezeAt = freezeStart(window)
  const startAt = parseTime(window.starts_at)
  const endAt = blockEnd(window)

  if (now < noticeAt || now >= endAt) return 'none'
  if (now >= startAt) return 'active'
  if (now >= freezeAt) return 'freeze'
  return 'upcoming'
}

export async function listMaintenanceWindows(): Promise<MaintenanceWindow[]> {
  const { data, error } = await supabase
    .from('maintenance_windows')
    .select('*')
    .order('starts_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to list maintenance windows: ${error.message}`)
  }

  return (data ?? []) as MaintenanceWindow[]
}

export async function getMaintenanceStatus(now = Date.now()): Promise<MaintenanceStatus> {
  const windows = await listMaintenanceWindows()
  let phase: MaintenancePhase = 'none'
  let endsAt: string | null = null
  let startsAt: string | null = null

  for (const window of windows) {
    const windowPhase = phaseForWindow(window, now)
    if (windowPhase === 'none') continue

    if (PHASE_PRIORITY[windowPhase] > PHASE_PRIORITY[phase]) {
      phase = windowPhase
    }

    if (!endsAt || blockEnd(window) > parseTime(endsAt)) {
      endsAt = window.ends_at
    }

    if (!startsAt || parseTime(window.starts_at) < parseTime(startsAt)) {
      startsAt = window.starts_at
    }
  }

  return { phase, endsAt, startsAt: phase === 'none' ? null : startsAt }
}

export async function getMaintenanceBlock(now = Date.now()): Promise<MaintenanceBlock | null> {
  const status = await getMaintenanceStatus(now)
  if (status.phase !== 'freeze' && status.phase !== 'active') return null
  if (!status.endsAt) return null

  if (status.phase === 'freeze') {
    return {
      code: 'MAINTENANCE_FREEZE',
      message:
        'New games are paused briefly while we prepare an update. You can finish games already in progress.',
      endsAt: status.endsAt
    }
  }

  return {
    code: 'MAINTENANCE_ACTIVE',
    message: "We're updating content. New games will be back soon.",
    endsAt: status.endsAt
  }
}

export async function canPurgeDataset(datasetId: string, now = Date.now()): Promise<boolean> {
  const windows = await listMaintenanceWindows()

  for (const window of windows) {
    if (phaseForWindow(window, now) !== 'active') continue
    if (window.dataset_id == null || window.dataset_id === datasetId) {
      return true
    }
  }

  return false
}

export interface CreateMaintenanceInput {
  startsAt: string
  endsAt: string
  datasetId?: string | null
  adminNote?: string | null
  createdBy?: string | null
}

export async function createMaintenanceWindow(input: CreateMaintenanceInput): Promise<MaintenanceWindow> {
  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  const now = Date.now()

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new MaintenanceScheduleError('INVALID_RANGE', 'Invalid start or end time')
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new MaintenanceScheduleError('INVALID_RANGE', 'End time must be after start time')
  }

  if (startsAt.getTime() < now + MAINTENANCE_FREEZE_LEAD_MS) {
    throw new MaintenanceScheduleError(
      'STARTS_TOO_SOON',
      'Maintenance must start at least 15 minutes from now'
    )
  }

  const candidate = {
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString()
  }

  const existing = await listMaintenanceWindows()
  for (const window of existing) {
    if (blockEnd(window) <= now) continue
    if (windowsOverlap(candidate, window)) {
      throw new MaintenanceScheduleError(
        'OVERLAPPING_WINDOW',
        'This window overlaps an existing maintenance window'
      )
    }
  }

  const { data, error } = await supabase
    .from('maintenance_windows')
    .insert({
      dataset_id: input.datasetId ?? null,
      starts_at: candidate.starts_at,
      ends_at: candidate.ends_at,
      admin_note: input.adminNote ?? null,
      created_by: input.createdBy ?? null
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create maintenance window: ${error.message}`)
  }

  return data as MaintenanceWindow
}

export async function cancelMaintenanceWindow(id: string, now = Date.now()): Promise<void> {
  const { data, error } = await supabase
    .from('maintenance_windows')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load maintenance window: ${error.message}`)
  }

  if (!data) {
    throw new MaintenanceScheduleError('NOT_FOUND', 'Maintenance window not found')
  }

  const window = data as MaintenanceWindow
  if (freezeStart(window) <= now) {
    throw new MaintenanceScheduleError(
      'CANNOT_CANCEL',
      'Cannot cancel a window that has already entered the freeze period'
    )
  }

  const { error: deleteError } = await supabase.from('maintenance_windows').delete().eq('id', id)

  if (deleteError) {
    throw new Error(`Failed to cancel maintenance window: ${deleteError.message}`)
  }
}
