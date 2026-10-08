import type { InPersonCard } from '../types'
import type { MasteryChange } from './soloMastery'
import type { EntityTypeFilter } from './entityTypeFilter'
import {
  coerceDifficultySelection,
  difficultySelectionEquals,
  formatDifficultySelection,
  type DifficultySelection
} from './difficultySelection'
import { estimateLegacySoloScore } from './soloScoring'

export const SOLO_CHALLENGE_ROUNDS = 10
export const SOLO_RECORDS_PER_MODE = 10
const SESSION_KEY = 'whoami-solo-session'
const RECORDS_KEY = 'whoami-solo-records'
const SETUP_KEY = 'whoami-solo-setup'

export type SoloVariation = 'challenge' | 'endurance' | 'daily' | 'review'

export type SoloConfig = {
  datasetId: string
  /** Empty = any difficulty. */
  difficulty: DifficultySelection
  entityType: EntityTypeFilter
  variation: SoloVariation
  roundDurationMs: number
  clueRevealIntervalMs: number
  dailyChallengeId?: string
  dailyDateKey?: string
}

export type SoloScoreBreakdown = {
  score: number
  basePoints: number
  cluePenalty: number
  timePenalty: number
  incorrectGuessPenalty: number
  bonusPoints: number
}

export type KnowledgeScoreRules = {
  basePoints: number
  additionalCluePenalty: number
  elapsedSecondPenalty: number
  incorrectGuessPenalty: number
  minimumCorrectScore: number
}

export type SoloRoundPerformance = {
  entityId: string
  correct: boolean
  revealedClueCount: number
  incorrectGuessCount: number
  elapsedMs: number
  score: number
  breakdown: SoloScoreBreakdown
}

export type SoloSession = SoloConfig & {
  entityIds: string[]
  index: number
  correctCount: number
  activeElapsedMs: number
  /** Wall-clock ms when the current round timer started; kept across refresh. */
  roundStartedAt?: number | null
  /** Remaining ms when the round settled; frozen so refresh does not reveal extra clues. */
  roundRemainingMs?: number | null
  /** In-round UI status; restored after refresh so settle screens survive. */
  roundStatus?: 'active' | 'correct' | 'timeout' | null
  /** Frozen card for `entityIds[index]`; survives refresh without reshuffling clues. */
  currentCard?: InPersonCard | null
  /** Cumulative score. Optional while migrating sessions created before scoring. */
  score?: number
  rounds?: SoloRoundPerformance[]
  currentIncorrectGuessCount?: number
  /** Frozen outcome waiting for the player to advance. */
  settledRoundPerformance?: SoloRoundPerformance | null
  /** Mastery state change for the frozen outcome; survives refresh. */
  settledMasteryChange?: MasteryChange | null
  /** Mastery moves from this run, one entry per card. */
  masteryChanges?: MasteryChange[]
  scoringVersion?: number
  scoringRules?: KnowledgeScoreRules
}

export type SoloScoreSource = 'live' | 'migrated'

export type SoloRecord = SoloConfig & {
  correctCount: number
  activeElapsedMs: number
  achievedAt: string
  /** Missing on records created before scored Solo launched. */
  score?: number
  /** How {@link score} was produced; `migrated` is a one-time estimate from legacy stats. */
  scoreSource?: SoloScoreSource
  rounds?: SoloRoundPerformance[]
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

export function createSoloSession(
  config: SoloConfig,
  entityIds: string[],
  scoring?: { version: number; rules: KnowledgeScoreRules }
): SoloSession {
  return {
    ...config,
    entityIds:
      config.variation === 'challenge' || config.variation === 'daily'
        ? entityIds.slice(0, SOLO_CHALLENGE_ROUNDS)
        : entityIds,
    index: 0,
    correctCount: 0,
    activeElapsedMs: 0,
    roundStartedAt: null,
    roundRemainingMs: null,
    roundStatus: null,
    currentCard: null,
    score: 0,
    rounds: [],
    currentIncorrectGuessCount: 0,
    settledRoundPerformance: null,
    settledMasteryChange: null,
    masteryChanges: [],
    scoringVersion: scoring?.version,
    scoringRules: scoring?.rules
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
    const rounds = Array.isArray(session.rounds) ? session.rounds : []
    return {
      ...session,
      rounds,
      score:
        typeof session.score === 'number'
          ? session.score
          : rounds.reduce((sum, round) => sum + round.score, 0),
      currentIncorrectGuessCount: session.currentIncorrectGuessCount ?? 0,
      settledRoundPerformance: session.settledRoundPerformance ?? null,
      settledMasteryChange: session.settledMasteryChange ?? null,
      masteryChanges: Array.isArray(session.masteryChanges) ? session.masteryChanges : []
    }
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

function scoreValue(record: Pick<SoloRecord, 'score'>): number {
  return typeof record.score === 'number' ? record.score : -1
}

/** True when candidate should rank above current for the same mode. */
export function isBetterRecord(
  candidate: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs' | 'score' | 'variation'>,
  current: Pick<SoloRecord, 'correctCount' | 'activeElapsedMs' | 'score' | 'variation'>
): boolean {
  return (
    compareRecords(
      {
        ...candidate,
        datasetId: '',
        difficulty: [],
        entityType: 'character',
        roundDurationMs: 0,
        clueRevealIntervalMs: 0,
        achievedAt: '1970-01-01T00:00:00.000Z'
      },
      {
        ...current,
        datasetId: '',
        difficulty: [],
        entityType: 'character',
        roundDurationMs: 0,
        clueRevealIntervalMs: 0,
        achievedAt: '1970-01-01T00:00:00.000Z'
      }
    ) < 0
  )
}

function compareRecords(a: SoloRecord, b: SoloRecord): number {
  // Endurance is streak-first; score is only a tiebreaker (and for display).
  if (a.variation === 'endurance' && b.variation === 'endurance') {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
    if (a.activeElapsedMs !== b.activeElapsedMs) return a.activeElapsedMs - b.activeElapsedMs
    if (scoreValue(b) !== scoreValue(a)) return scoreValue(b) - scoreValue(a)
    return b.achievedAt.localeCompare(a.achievedAt)
  }

  if (a.score != null || b.score != null) {
    if (a.score == null) return 1
    if (b.score == null) return -1
    if (b.score !== a.score) return b.score - a.score
  }
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
  if (a.activeElapsedMs !== b.activeElapsedMs) return a.activeElapsedMs - b.activeElapsedMs
  return b.achievedAt.localeCompare(a.achievedAt)
}

function canMigrateLegacyScore(record: SoloRecord): boolean {
  if (typeof record.score === 'number') return false
  return record.variation === 'challenge' || record.variation === 'endurance'
}

function migrateLegacySoloRecord(record: SoloRecord): SoloRecord {
  if (!canMigrateLegacyScore(record)) return record
  return {
    ...record,
    score: estimateLegacySoloScore({
      correctCount: record.correctCount,
      activeElapsedMs: record.activeElapsedMs,
      clueRevealIntervalMs: record.clueRevealIntervalMs
    }),
    scoreSource: 'migrated'
  }
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

function prepareSoloRecords(records: SoloRecord[]): {
  records: SoloRecord[]
  migrated: boolean
} {
  let migrated = false
  const next = records.map((record) => {
    const normalized = normalizeConfigDifficulty(record)
    if (!canMigrateLegacyScore(normalized)) return normalized
    migrated = true
    return migrateLegacySoloRecord(normalized)
  })
  return { records: capRecords(next), migrated }
}

function writeSoloRecords(records: SoloRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

function readSoloRecords(): SoloRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as SoloRecord[]) : []
    const { records, migrated } = prepareSoloRecords(parsed)
    if (migrated) writeSoloRecords(records)
    return records
  } catch {
    return []
  }
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

function sameSavedAttempt(stored: SoloRecord, attempt: SoloRecord): boolean {
  return (
    stored.achievedAt === attempt.achievedAt &&
    stored.correctCount === attempt.correctCount &&
    stored.activeElapsedMs === attempt.activeElapsedMs &&
    stored.score === attempt.score
  )
}

/** 1-based place in this mode's top 10, or null when the attempt was not kept. */
export function soloRecordPlace(record: SoloRecord): number | null {
  const ranked = listSoloRecords(record.variation, record.datasetId)
  const index = ranked.findIndex((item) => sameSavedAttempt(item, record))
  return index < 0 ? null : index + 1
}

/** Label for a saved run that made the top 10 without taking first place. */
export function formatSoloTopTenPlace(place: number): string | null {
  if (place < 2 || place > SOLO_RECORDS_PER_MODE) return null
  const mod100 = place % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : place % 10 === 1
        ? 'st'
        : place % 10 === 2
          ? 'nd'
          : place % 10 === 3
            ? 'rd'
            : 'th'
  return `${place}${suffix} in your top 10`
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
    const stored = readSoloRecords()
    const incoming =
      typeof record.score === 'number'
        ? { ...normalizeConfigDifficulty(record), scoreSource: record.scoreSource ?? ('live' as const) }
        : migrateLegacySoloRecord(normalizeConfigDifficulty(record))
    const { records: capped } = prepareSoloRecords([...stored, incoming])
    writeSoloRecords(capped)

    const bucket = capped
      .filter((item) => sameRecordBucket(item, incoming))
      .sort(compareRecords)
    const best = bucket[0]
    const isPersonalBest =
      best?.achievedAt === incoming.achievedAt &&
      best?.correctCount === incoming.correctCount &&
      best?.activeElapsedMs === incoming.activeElapsedMs &&
      best?.score === incoming.score

    return { record: incoming, isPersonalBest }
  } catch {
    return { record, isPersonalBest: false }
  }
}

export function formatSoloTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export function formatSoloScore(score: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(score)))
}

export function soloSessionScore(session: Pick<SoloSession, 'score' | 'rounds'>): number {
  if (typeof session.score === 'number') return session.score
  return (session.rounds ?? []).reduce((sum, round) => sum + round.score, 0)
}

export function soloRecordAverageClues(record: Pick<SoloRecord, 'rounds'>): number | null {
  const correctRounds = (record.rounds ?? []).filter((round) => round.correct)
  if (correctRounds.length === 0) return null
  return (
    correctRounds.reduce((sum, round) => sum + round.revealedClueCount, 0) /
    correctRounds.length
  )
}

export function soloRecordFirstClueCorrectCount(
  record: Pick<SoloRecord, 'rounds'>
): number {
  return (record.rounds ?? []).filter(
    (round) => round.correct && round.revealedClueCount === 1
  ).length
}

/** Missed cards from one run, in the order they were played. Names stay out. */
export function missedEntityIds(record: Pick<SoloRecord, 'rounds'>): string[] {
  const ids: string[] = []
  for (const round of record.rounds ?? []) {
    if (round.correct || !round.entityId || ids.includes(round.entityId)) continue
    ids.push(round.entityId)
  }
  return ids
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
  if (variation === 'challenge') return 'Classic'
  if (variation === 'daily') return 'Daily challenge'
  if (variation === 'review') return 'Review'
  return 'Endurance'
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
