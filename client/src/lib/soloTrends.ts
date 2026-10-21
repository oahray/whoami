import { tallyRounds, type RoundTally } from './dailySolo'
import {
  coerceDifficultySelection,
  encodeDifficultySelection,
  formatDifficultySelection,
  isAnyDifficultySelection,
  type DifficultySelection
} from './difficultySelection'
import { entityTypeOptionLabel, type EntityTypeFilter } from './entityTypeFilter'
import type { SoloRecord } from './soloSession'

const TRENDS_KEY = 'whoami-solo-trends-v1'

export type TrendVariation = 'challenge' | 'endurance'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/** All Classic or all Endurance runs finished on one local day, added together. */
export type TrendDay = {
  v: 1
  variation: TrendVariation
  /** The player's local date, since these modes have no server day. */
  dateKey: string
  runs: number
  totalScore: number
  bestScore: number
  cards: number
  correct: number
  solvedOnClue: number[]
  wrongGuesses: number
  timeMs: number
  fastestSolveMs: number | null
  /** Most correct answers in one run; the run length for Endurance. */
  longestRun: number
  byType: RoundTally['byType']
  timesOfDay: Partial<Record<TimeOfDay, number>>
  /** Runs per setup, keyed by {@link setupKey}. */
  setups?: Record<string, number>
}

type TrendStore = { version: 1; days: Record<string, TrendDay> }

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function loadStore(): TrendStore {
  try {
    const raw = localStorage.getItem(TRENDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<TrendStore>) : null
    return parsed?.version === 1 && parsed.days ? (parsed as TrendStore) : { version: 1, days: {} }
  } catch {
    return { version: 1, days: {} }
  }
}

export function listTrendDays(variation: TrendVariation): TrendDay[] {
  return Object.values(loadStore().days)
    .filter((day) => day.variation === variation)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

/** Adds a finished Classic or Endurance run to its day. Review and Daily runs are not trends. */
export function recordTrendRun(record: SoloRecord, finishedAt = new Date()): void {
  if (record.variation !== 'challenge' && record.variation !== 'endurance') return
  const store = loadStore()
  const dateKey = localDateKey(finishedAt)
  const id = `${record.variation}:${dateKey}`
  const tally = tallyRounds(record.rounds ?? [])
  const score = typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : 0
  const slot = timeOfDay(finishedAt.getHours())
  const setup = setupKey(record)
  const day: TrendDay = store.days[id] ?? {
    v: 1,
    variation: record.variation,
    dateKey,
    runs: 0,
    totalScore: 0,
    bestScore: 0,
    cards: 0,
    correct: 0,
    solvedOnClue: [],
    wrongGuesses: 0,
    timeMs: 0,
    fastestSolveMs: null,
    longestRun: 0,
    byType: { character: [0, 0], place: [0, 0] },
    timesOfDay: {}
  }
  tally.solvedOnClue.forEach((count, index) => {
    day.solvedOnClue[index] = (day.solvedOnClue[index] ?? 0) + count
  })
  for (const type of ['character', 'place'] as const) {
    day.byType[type][0] += tally.byType[type][0]
    day.byType[type][1] += tally.byType[type][1]
  }
  store.days[id] = {
    ...day,
    runs: day.runs + 1,
    totalScore: day.totalScore + score,
    bestScore: Math.max(day.bestScore, score),
    cards: day.cards + (record.rounds?.length ?? 0),
    correct: day.correct + record.correctCount,
    wrongGuesses: day.wrongGuesses + tally.wrongGuesses,
    timeMs: day.timeMs + record.activeElapsedMs,
    fastestSolveMs:
      tally.fastestSolveMs == null
        ? day.fastestSolveMs
        : Math.min(day.fastestSolveMs ?? Number.POSITIVE_INFINITY, tally.fastestSolveMs),
    longestRun: Math.max(day.longestRun, record.correctCount),
    timesOfDay: { ...day.timesOfDay, [slot]: (day.timesOfDay[slot] ?? 0) + 1 },
    setups: { ...day.setups, [setup]: (day.setups?.[setup] ?? 0) + 1 }
  }
  try {
    localStorage.setItem(TRENDS_KEY, JSON.stringify(store))
  } catch {
    // Trends are a nice-to-have; a full storage space must not break the results screen.
  }
}

export type SoloSetupChoice = {
  difficulty: DifficultySelection
  entityType: EntityTypeFilter
  roundDurationMs: number
  clueRevealIntervalMs: number
}

/** "Characters, Easy + Medium" and "30s per card, new clue every 5s", as the Start button reads. */
export function describeSoloSetup(setup: SoloSetupChoice): { what: string; timing: string } {
  const difficulty = isAnyDifficultySelection(setup.difficulty)
    ? 'All difficulties'
    : formatDifficultySelection(setup.difficulty).replace(/ · /g, ' + ')
  return {
    what: `${entityTypeOptionLabel(setup.entityType)}, ${difficulty}`,
    timing: `${Math.round(setup.roundDurationMs / 1000)}s per card, new clue every ${Math.round(
      setup.clueRevealIntervalMs / 1000
    )}s`
  }
}

/** Dataset is left out: there is one for now, and the key would only split the same setup. */
export function setupKey(setup: SoloSetupChoice): string {
  return [
    encodeDifficultySelection(setup.difficulty),
    setup.entityType,
    setup.roundDurationMs,
    setup.clueRevealIntervalMs
  ].join('|')
}

export function parseSetupKey(key: string): SoloSetupChoice | null {
  const [difficulty, entityType, round, clue] = key.split('|')
  const roundDurationMs = Number(round)
  const clueRevealIntervalMs = Number(clue)
  if (!entityType || !Number.isFinite(roundDurationMs) || !Number.isFinite(clueRevealIntervalMs)) return null
  return {
    difficulty: coerceDifficultySelection(difficulty),
    entityType: entityType as EntityTypeFilter,
    roundDurationMs,
    clueRevealIntervalMs
  }
}
