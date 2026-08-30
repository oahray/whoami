import type { InPersonCard } from '../types'
import type { EntityTypeFilter } from './entityTypeFilter'
import {
  coerceDifficultySelection,
  difficultySelectionEquals,
  formatDifficultySelection,
  type DifficultySelection
} from './difficultySelection'

export const SOLO_CHALLENGE_ROUNDS = 10
export const SOLO_RECORDS_PER_MODE = 5
const SESSION_KEY = 'whoami-solo-session'
const RECORDS_KEY = 'whoami-solo-records'
const SETUP_KEY = 'whoami-solo-setup'

export type SoloVariation = 'challenge' | 'endurance'

export type SoloConfig = {
  datasetId: string
  /** Empty = any difficulty. */
  difficulty: DifficultySelection
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
  /** Wall-clock ms when the current round timer started; kept across refresh. */
  roundStartedAt?: number | null
  /** In-round UI status; restored after refresh so settle screens survive. */
  roundStatus?: 'active' | 'correct' | 'timeout' | null
  /** Frozen card for `entityIds[index]`; survives refresh without reshuffling clues. */
  currentCard?: InPersonCard | null
}

export type SoloRecord = SoloConfig & {
  correctCount: number
  activeElapsedMs: number
  achievedAt: string
}

export type SoloSetupPreferences = {
  datasetId?: string
  difficulty: DifficultySelection
  entityType: EntityTypeFilter
  variation: SoloVariation
  roundDurationMs: number
  clueRevealIntervalMs: number
}

function normalizeConfigDifficulty<T extends { difficulty: unknown }>(value: T): T & { difficulty: DifficultySelection } {
  return { ...value, difficulty: coerceDifficultySelection(value.difficulty) }
}

export function createSoloSession(config: SoloConfig, entityIds: string[]): SoloSession {
  return {
    ...config,
    entityIds: config.variation === 'challenge' ? entityIds.slice(0, SOLO_CHALLENGE_ROUNDS) : entityIds,
    index: 0,
    correctCount: 0,
    activeElapsedMs: 0,
    roundStartedAt: null,
    roundStatus: null,
    currentCard: null
  }
}

function isInPersonCard(value: unknown): value is InPersonCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<InPersonCard>
  const entity = card.entity
  return (
    !!entity &&
    typeof entity.id === 'string' &&
    typeof entity.name === 'string' &&
    (entity.type === 'character' || entity.type === 'place') &&
    Array.isArray(entity.aliases) &&
    Array.isArray(card.clues) &&
    card.clues.every(
      (clue) =>
        clue &&
        typeof clue.order === 'number' &&
        typeof clue.text === 'string' &&
        (clue.citations === null || typeof clue.citations === 'string')
    )
  )
}

/** Stored card only counts when it belongs to the current round's entity. */
export function cardForCurrentSoloRound(session: SoloSession): InPersonCard | null {
  const entityId = session.entityIds[session.index]
  const card = session.currentCard
  if (!entityId || !isInPersonCard(card) || card.entity.id !== entityId) return null
  if (card.clues.length === 0) return null
  return card
}

export function saveSoloSession(session: SoloSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // quota / private mode — keep playing from memory
  }
}

export function loadSoloSession(): SoloSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = normalizeConfigDifficulty(JSON.parse(raw) as SoloSession)
    if (!Array.isArray(session.entityIds) || !session.datasetId || !session.variation) return null
    if (session.currentCard != null && !isInPersonCard(session.currentCard)) {
      session.currentCard = null
    }
    return session
  } catch {
    return null
  }
}

export function clearSoloSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function saveSoloSetupPreferences(prefs: SoloSetupPreferences): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / private mode
  }
}

export function loadSoloSetupPreferences(): SoloSetupPreferences | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY)
    if (!raw) return null
    const prefs = normalizeConfigDifficulty(JSON.parse(raw) as SoloSetupPreferences)
    if (!prefs.variation || prefs.difficulty == null || !prefs.entityType) return null
    if (!prefs.roundDurationMs || !prefs.clueRevealIntervalMs) return null
    return prefs
  } catch {
    return null
  }
}

function sameRecordCategory(a: SoloConfig, b: SoloConfig): boolean {
  return (
    a.datasetId === b.datasetId &&
    difficultySelectionEquals(
      coerceDifficultySelection(a.difficulty),
      coerceDifficultySelection(b.difficulty)
    ) &&
    a.entityType === b.entityType &&
    a.variation === b.variation &&
    a.roundDurationMs === b.roundDurationMs &&
    a.clueRevealIntervalMs === b.clueRevealIntervalMs
  )
}

function sameRecordBucket(a: Pick<SoloRecord, 'datasetId' | 'variation'>, b: Pick<SoloRecord, 'datasetId' | 'variation'>): boolean {
  return a.datasetId === b.datasetId && a.variation === b.variation
}

export function isBetterRecord(
  candidate: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs'>,
  current: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs'>
): boolean {
  return (
    candidate.correctCount > current.correctCount ||
    (candidate.correctCount === current.correctCount &&
      candidate.activeElapsedMs < current.activeElapsedMs)
  )
}

function compareRecords(a: SoloRecord, b: SoloRecord): number {
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
  if (a.activeElapsedMs !== b.activeElapsedMs) return a.activeElapsedMs - b.activeElapsedMs
  return b.achievedAt.localeCompare(a.achievedAt)
}

function readSoloRecords(): SoloRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    const records = raw ? (JSON.parse(raw) as SoloRecord[]) : []
    return records.map((record) => normalizeConfigDifficulty(record))
  } catch {
    return []
  }
}

function writeSoloRecords(records: SoloRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

/** Trim each dataset+variation bucket to the top N (migrates older stores). */
function capRecords(records: SoloRecord[]): SoloRecord[] {
  const buckets = new Map<string, SoloRecord[]>()
  for (const record of records) {
    const key = `${record.datasetId}:${record.variation}`
    const list = buckets.get(key) ?? []
    list.push(record)
    buckets.set(key, list)
  }
  const next: SoloRecord[] = []
  for (const list of buckets.values()) {
    next.push(...[...list].sort(compareRecords).slice(0, SOLO_RECORDS_PER_MODE))
  }
  return next
}

export function getSoloRecord(config: SoloConfig): SoloRecord | null {
  const matching = readSoloRecords().filter((record) => sameRecordCategory(record, config))
  if (matching.length === 0) return null
  return [...matching].sort(compareRecords)[0] ?? null
}

export function listSoloRecords(variation?: SoloVariation, datasetId?: string): SoloRecord[] {
  return capRecords(readSoloRecords())
    .filter((record) => (variation ? record.variation === variation : true))
    .filter((record) => (datasetId ? record.datasetId === datasetId : true))
    .sort(compareRecords)
}

export function shuffleEntityIds(entityIds: string[]): string[] {
  const next = [...entityIds]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** Reshuffle the endurance pool so a long streak can continue past one pass. */
export function continueEndurancePool(session: SoloSession, lastEntityId: string): SoloSession {
  if (session.entityIds.length === 0) return { ...session, index: 0 }
  let entityIds = shuffleEntityIds(session.entityIds)
  if (entityIds.length > 1 && entityIds[0] === lastEntityId) {
    const swapWith = 1 + Math.floor(Math.random() * (entityIds.length - 1))
    ;[entityIds[0], entityIds[swapWith]] = [entityIds[swapWith], entityIds[0]]
  }
  return { ...session, entityIds, index: 0, currentCard: null }
}

/** Prefetch the next card only when this settle will actually continue the run. */
export function shouldPrefetchNextSoloCard(
  session: SoloSession,
  status: 'active' | 'correct' | 'timeout' | 'finished'
): boolean {
  if (status !== 'correct' && status !== 'timeout') return false
  if (session.variation === 'endurance' && status === 'timeout') return false
  return Boolean(session.entityIds[session.index + 1])
}

/**
 * Always store the attempt, keep the best {@link SOLO_RECORDS_PER_MODE} per
 * dataset + variation, and report whether this run is #1 in that bucket.
 */
export function saveSoloRecord(record: SoloRecord): { record: SoloRecord; isPersonalBest: boolean } {
  try {
    const records = readSoloRecords()
    const withAttempt = [...records, record]
    const capped = capRecords(withAttempt)
    writeSoloRecords(capped)

    const bucket = capped
      .filter((item) => sameRecordBucket(item, record))
      .sort(compareRecords)
    const isPersonalBest =
      bucket[0]?.achievedAt === record.achievedAt &&
      bucket[0]?.correctCount === record.correctCount &&
      bucket[0]?.activeElapsedMs === record.activeElapsedMs

    return { record, isPersonalBest }
  } catch {
    return { record, isPersonalBest: false }
  }
}

export function formatSoloTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/** Relative or short absolute date for when a personal best was set. */
export function formatSoloRecordAchievedAt(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = now - t
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(t))
}

export function soloVariationLabel(variation: SoloVariation): string {
  return variation === 'challenge' ? 'Solo challenge' : 'Endurance'
}

export function soloConfigSummary(
  config: SoloConfig,
  options: { includeVariation?: boolean } = {}
): string {
  const includeVariation = options.includeVariation !== false
  const typeLabel =
    config.entityType === 'place'
      ? 'Places'
      : config.entityType === 'all'
        ? 'Characters & places'
        : 'Characters'
  const parts = [
    ...(includeVariation ? [soloVariationLabel(config.variation)] : []),
    typeLabel,
    formatDifficultySelection(coerceDifficultySelection(config.difficulty)),
    `${config.roundDurationMs / 1000}s cards`,
    `${config.clueRevealIntervalMs / 1000}s clues`
  ]
  return parts.join(' · ')
}
