import { API_BASE_URL } from './apiBase'
import type {
  KnowledgeScoreRules,
  SoloRecord
} from './soloSession'

const DAILY_PROGRESS_KEY = 'whoami-solo-daily-progress'

export type DailyChallenge = {
  challengeId: string
  challengeVersion: number
  dateKey: string
  datasetId: string
  datasetName: string
  difficulty: 'any'
  entityType: 'all'
  roundDurationMs: number
  clueRevealIntervalMs: number
  entityIds: string[]
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

export async function fetchDailyChallenge(): Promise<DailyChallenge> {
  const response = await fetch(`${API_BASE_URL}/cards/daily-challenge`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load daily challenge (${response.status})`)
  }
  return (await response.json()) as DailyChallenge
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

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000)
}

export function saveDailyResult(result: DailyResult): DailyProgress {
  const current = loadDailyProgress()
  if (current.results[result.challengeId]) return current

  const previousDay =
    current.lastCompletedDate == null
      ? null
      : dayNumber(current.lastCompletedDate)
  const completedDay = dayNumber(result.dateKey)
  const currentStreak =
    previousDay != null && completedDay - previousDay === 1
      ? current.currentStreak + 1
      : 1
  const next: DailyProgress = {
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    lastCompletedDate: result.dateKey,
    results: { ...current.results, [result.challengeId]: result }
  }
  localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(next))
  return next
}
