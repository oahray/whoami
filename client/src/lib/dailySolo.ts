import { API_BASE_URL } from './apiBase'
import { rememberDailyCard } from './inPersonCardFetch'
import type {
  KnowledgeScoreRules,
  SoloRecord
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
  record: SoloRecord
}

export type DailyProgress = {
  currentStreak: number
  bestStreak: number
  lastCompletedDate: string | null
  results: Record<string, DailyResult>
}

function emptyProgress(): DailyProgress {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    results: {}
  }
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
    return { ...emptyProgress(), ...(JSON.parse(raw) as DailyProgress) }
  } catch {
    return emptyProgress()
  }
}

/** Highest completed Daily score on this device. */
export function getDailyBestScore(progress: DailyProgress): number | null {
  const scores = Object.values(progress.results)
    .map((result) => result.record.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
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
    Object.values(progress.results).map((result) => result.dateKey),
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
  if (current.results[result.challengeId]) return current

  const results = { ...current.results, [result.challengeId]: result }
  const streaks = computeDailyStreaks(
    Object.values(results).map((entry) => entry.dateKey),
    result.dateKey
  )
  const next: DailyProgress = {
    currentStreak: streaks.current,
    bestStreak: Math.max(current.bestStreak, streaks.best),
    lastCompletedDate: result.dateKey,
    results
  }
  localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(next))
  return next
}
