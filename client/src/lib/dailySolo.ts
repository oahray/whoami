import { API_BASE_URL } from './apiBase'
import { rememberDailyCard } from './inPersonCardFetch'
import type {
  KnowledgeScoreRules,
  SoloRecord,
  SoloRoundPerformance
} from './soloSession'
import type { InPersonCard } from '../types'

const DAILY_PROGRESS_KEY = 'whoami-solo-daily-progress'

export type DailyChallenge = {
  challengeId: string
  challengeVersion: number
  dateKey: string
  datasetId: string
  datasetName: string
  difficulty: 'any' | 'nightmare'
  entityType: 'all'
  roundDurationMs: number
  clueRevealIntervalMs: number
  entityIds: string[]
  /** Server-frozen cards for this challenge (same clues on every device). */
  cards?: Record<string, InPersonCard>
  scoringVersion: number
  scoringRules: KnowledgeScoreRules
}

export type DailyResult = {
  challengeId: string
  dateKey: string
  completedAt: string
  scoringVersion?: number
  record: SoloRecord
}

/** One played Daily, kept forever. Full round detail is only kept for recent days. */
export type DailySummary = {
  v: 1
  challengeId: string
  dateKey: string
  completedAt: string
  /** Minutes ahead of UTC on the device when the Daily was finished. */
  tzOffsetMin: number
  scoringVersion: number
  score: number | null
  cardCount: number
  correctCount: number
  /** Index 0 counts cards solved on clue 1, index 1 on clue 2, and so on. */
  solvedOnClue: number[]
  wrongGuesses: number
  timeMs: number
  fastestSolveMs: number | null
  byType: RoundTally['byType']
}

export type DailyProgress = {
  currentStreak: number
  bestStreak: number
  lastCompletedDate: string | null
  /** Full results for the last {@link DAILY_DETAIL_DAYS} days only. */
  results: Record<string, DailyResult>
  summaries: Record<string, DailySummary>
}

/** Today's share image needs the rounds; nothing reads older round detail. */
export const DAILY_DETAIL_DAYS = 30

function emptyProgress(): DailyProgress {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    results: {},
    summaries: {}
  }
}

export type RoundTally = {
  solvedOnClue: number[]
  wrongGuesses: number
  fastestSolveMs: number | null
  byType: { character: [correct: number, total: number]; place: [correct: number, total: number] }
}

/** Per-clue solves, wrong guesses, fastest solve and type split from a run's rounds. */
export function tallyRounds(rounds: SoloRoundPerformance[]): RoundTally {
  const solvedOnClue: number[] = []
  const byType: RoundTally['byType'] = { character: [0, 0], place: [0, 0] }
  let wrongGuesses = 0
  let fastestSolveMs: number | null = null
  for (const round of rounds) {
    // Rounds saved before entityType existed are all characters; places came later.
    const tally = byType[round.entityType ?? 'character']
    tally[1] += 1
    wrongGuesses += round.incorrectGuessCount
    if (!round.correct) continue
    tally[0] += 1
    const clueIndex = Math.max(0, round.revealedClueCount - 1)
    while (solvedOnClue.length <= clueIndex) solvedOnClue.push(0)
    solvedOnClue[clueIndex] += 1
    fastestSolveMs = fastestSolveMs == null ? round.elapsedMs : Math.min(fastestSolveMs, round.elapsedMs)
  }
  return { solvedOnClue, wrongGuesses, fastestSolveMs, byType }
}

export function summarizeDailyResult(result: DailyResult): DailySummary {
  const rounds = result.record.rounds ?? []
  const { solvedOnClue, wrongGuesses, fastestSolveMs, byType } = tallyRounds(rounds)
  const score = result.record.score
  return {
    v: 1,
    challengeId: result.challengeId,
    dateKey: result.dateKey,
    completedAt: result.completedAt,
    tzOffsetMin: -new Date(result.completedAt).getTimezoneOffset(),
    // Version 1 is the only scoring there has been, so older days without it used it.
    scoringVersion: result.scoringVersion ?? 1,
    score: typeof score === 'number' && Number.isFinite(score) ? score : null,
    cardCount: rounds.length,
    correctCount: result.record.correctCount,
    solvedOnClue,
    wrongGuesses,
    timeMs: result.record.activeElapsedMs,
    fastestSolveMs,
    byType
  }
}

/** Fills summaries for results saved before summaries existed. */
function withSummaries(progress: DailyProgress): DailyProgress {
  const missing = Object.values(progress.results).filter(
    (result) => !progress.summaries[result.challengeId]
  )
  if (missing.length === 0) return progress
  const summaries = { ...progress.summaries }
  for (const result of missing) summaries[result.challengeId] = summarizeDailyResult(result)
  return { ...progress, summaries }
}

function trimDetail(
  results: Record<string, DailyResult>,
  latestDateKey: string,
  keepDays: number
): Record<string, DailyResult> {
  const oldest = dayNumber(latestDateKey) - keepDays + 1
  return Object.fromEntries(
    Object.entries(results).filter(([, result]) => dayNumber(result.dateKey) >= oldest)
  )
}

/** Seed the Daily card cache from the challenge snapshot so play never reshuffles. */
export function hydrateDailyCardCache(challenge: DailyChallenge): void {
  if (!challenge.cards) return
  for (const entityId of challenge.entityIds) {
    const card = challenge.cards[entityId]
    if (card) rememberDailyCard(challenge.challengeId, entityId, card)
  }
}

export async function fetchDailyChallenge(): Promise<DailyChallenge> {
  const response = await fetch(`${API_BASE_URL}/cards/daily-challenge`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load daily challenge (${response.status})`)
  }
  const challenge = (await response.json()) as DailyChallenge
  hydrateDailyCardCache(challenge)
  return challenge
}

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = localStorage.getItem(DAILY_PROGRESS_KEY)
    if (!raw) return emptyProgress()
    return withSummaries({ ...emptyProgress(), ...(JSON.parse(raw) as Partial<DailyProgress>) })
  } catch {
    return emptyProgress()
  }
}

/** Highest completed Daily score on this device. */
export function getDailyBestScore(progress: DailyProgress): number | null {
  const scores = Object.values(progress.summaries)
    .map((summary) => summary.score)
    .filter((score): score is number => score != null)
  return scores.length > 0 ? Math.max(...scores) : null
}

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000)
}

/** Milliseconds until the Daily after `dateKey` unlocks (the next UTC midnight). */
export function msUntilNextDaily(dateKey: string, now = Date.now()): number {
  return Math.max(0, Date.parse(`${dateKey}T00:00:00Z`) + 86_400_000 - now)
}

/** Short countdown label: "3h 12m", "3h", "42m" or "under a minute". */
export function formatDailyCountdown(ms: number): string {
  if (ms < 60_000) return 'under a minute'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

/** UTC date key, matching the server Daily challenge day. */
export function dailyDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function dateKeyFromDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

/** A missed day only counts as a rest day if no other rest day falls within the 7 days before it. */
const REST_DAY_SPACING = 7

export type DailyStreakInfo = {
  current: number
  best: number
  /** Missed days bridged between two played days, across all history. */
  restDaysUsed: number
  /** Most recent rest day still blocking another one, if any. */
  restDay: { usedOn: string; nextAvailableOn: string; coversYesterday: boolean } | null
}

/**
 * Streaks from the full Daily history, so rule changes apply retroactively.
 * One missed day keeps a streak alive when it's at least 7 days after the
 * previous rest day (at most one rest day in any 7 days). Rest days don't
 * add to the count.
 */
export function computeDailyStreaks(dateKeys: string[], todayKey = dailyDateKey()): DailyStreakInfo {
  const days = [...new Set(dateKeys.map(dayNumber))].sort((a, b) => a - b)
  let count = 0
  let best = 0
  let restDaysUsed = 0
  let lastRest = Number.NEGATIVE_INFINITY
  let prev: number | null = null
  for (const day of days) {
    const gap = prev == null ? Number.POSITIVE_INFINITY : day - prev
    if (gap === 1) {
      count += 1
    } else if (gap === 2 && day - 1 - lastRest >= REST_DAY_SPACING) {
      count += 1
      lastRest = day - 1
      restDaysUsed += 1
    } else {
      count = 1
      lastRest = Number.NEGATIVE_INFINITY
    }
    best = Math.max(best, count)
    prev = day
  }

  const today = dayNumber(todayKey)
  let current = 0
  let coversYesterday = false
  if (prev != null) {
    const gap = today - prev
    if (gap === 0 || gap === 1) {
      current = count
    } else if (gap === 2 && today - 1 - lastRest >= REST_DAY_SPACING) {
      current = count
      lastRest = today - 1
      coversYesterday = true
    }
  }

  const restDay =
    current > 0 && today - lastRest < REST_DAY_SPACING
      ? {
          usedOn: dateKeyFromDay(lastRest),
          nextAvailableOn: dateKeyFromDay(lastRest + REST_DAY_SPACING),
          coversYesterday
        }
      : null

  return { current, best, restDaysUsed, restDay }
}

function streaksFor(progress: DailyProgress, todayKey: string): DailyStreakInfo {
  return computeDailyStreaks(
    Object.values(progress.summaries).map((summary) => summary.dateKey),
    todayKey
  )
}

/** Streak still showing on `todayKey`, with at most one rest day in any 7 days. */
export function getActiveDailyStreak(
  progress: DailyProgress,
  todayKey = dailyDateKey()
): number {
  return streaksFor(progress, todayKey).current
}

/** Best streak, never lower than what was stored before rest days existed. */
export function getBestDailyStreak(progress: DailyProgress, todayKey = dailyDateKey()): number {
  return Math.max(progress.bestStreak, streaksFor(progress, todayKey).best)
}

export function getDailyRestDay(
  progress: DailyProgress,
  todayKey = dailyDateKey()
): DailyStreakInfo['restDay'] {
  return streaksFor(progress, todayKey).restDay
}

export function saveDailyResult(result: DailyResult): DailyProgress {
  const current = loadDailyProgress()
  if (current.summaries[result.challengeId]) return current

  const summaries = { ...current.summaries, [result.challengeId]: summarizeDailyResult(result) }
  const streaks = computeDailyStreaks(
    Object.values(summaries).map((entry) => entry.dateKey),
    result.dateKey
  )
  const next: DailyProgress = {
    currentStreak: streaks.current,
    bestStreak: Math.max(current.bestStreak, streaks.best),
    lastCompletedDate: result.dateKey,
    results: trimDetail(
      { ...current.results, [result.challengeId]: result },
      result.dateKey,
      DAILY_DETAIL_DAYS
    ),
    summaries
  }
  // If storage is full, drop older round detail before giving up; the summaries
  // are what streaks and stats need.
  for (const results of [next.results, trimDetail(next.results, result.dateKey, 1)]) {
    try {
      localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify({ ...next, results }))
      return { ...next, results }
    } catch {
      // try the smaller version
    }
  }
  return next
}
