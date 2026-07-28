import type { EntityTypeFilter } from './entityTypeFilter'
import type { GameDifficultyMode } from '../types'

export const SOLO_CHALLENGE_ROUNDS = 10
const SESSION_KEY = 'whoami-solo-session'
const RECORDS_KEY = 'whoami-solo-records'

export type SoloVariation = 'challenge' | 'endurance'

export type SoloConfig = {
  datasetId: string
  difficulty: GameDifficultyMode
  entityType: EntityTypeFilter
  variation: SoloVariation
  roundDurationMs: number
  clueRevealIntervalMs: number
}

export type SoloSession = SoloConfig & {
  entityIds: string[]
  index: number
  correctCount: number
  activeElapsedMs: number
}

export type SoloRecord = SoloConfig & {
  correctCount: number
  activeElapsedMs: number
  achievedAt: string
}

export function createSoloSession(config: SoloConfig, entityIds: string[]): SoloSession {
  return {
    ...config,
    entityIds: config.variation === 'challenge' ? entityIds.slice(0, SOLO_CHALLENGE_ROUNDS) : entityIds,
    index: 0,
    correctCount: 0,
    activeElapsedMs: 0
  }
}

export function saveSoloSession(session: SoloSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSoloSession(): SoloSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as SoloSession
    if (!Array.isArray(session.entityIds) || !session.datasetId || !session.variation) return null
    return session
  } catch {
    return null
  }
}

export function clearSoloSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

function sameRecordCategory(a: SoloConfig, b: SoloConfig): boolean {
  return (
    a.datasetId === b.datasetId &&
    a.difficulty === b.difficulty &&
    a.entityType === b.entityType &&
    a.variation === b.variation &&
    a.roundDurationMs === b.roundDurationMs &&
    a.clueRevealIntervalMs === b.clueRevealIntervalMs
  )
}

export function isBetterRecord(candidate: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs'>, current: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs'>): boolean {
  return (
    candidate.correctCount > current.correctCount ||
    (candidate.correctCount === current.correctCount &&
      candidate.activeElapsedMs < current.activeElapsedMs)
  )
}

export function getSoloRecord(config: SoloConfig): SoloRecord | null {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    const records = raw ? (JSON.parse(raw) as SoloRecord[]) : []
    return records.find((record) => sameRecordCategory(record, config)) ?? null
  } catch {
    return null
  }
}

export function saveSoloRecord(record: SoloRecord): { record: SoloRecord; isPersonalBest: boolean } {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    const records = raw ? (JSON.parse(raw) as SoloRecord[]) : []
    const existing = records.find((item) => sameRecordCategory(item, record))
    if (existing && !isBetterRecord(record, existing)) {
      return { record: existing, isPersonalBest: false }
    }
    const next = [...records.filter((item) => !sameRecordCategory(item, record)), record]
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
    return { record, isPersonalBest: true }
  } catch {
    return { record, isPersonalBest: false }
  }
}

export function formatSoloTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}
