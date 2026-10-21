import {
  computeDailyStreaks,
  dailyDateKey,
  type DailyProgress,
  type DailySummary,
  type RoundTally
} from './dailySolo'
import type { EntityMastery } from './soloMastery'
import { timeOfDay, type TimeOfDay, type TrendDay } from './soloTrends'

/** Fewer days than this and the trend sections would mostly be noise. */
export const STATS_MIN_DAYS = 3

/** One day of play in any mode, in the shape the stats are worked out from. */
export type StatsDay = {
  dateKey: string
  /** 0 is Sunday, on the player's own calendar. */
  weekday: number
  runs: number
  /** Runs with a score; Dailies from before scoring have none. */
  scoredRuns: number
  totalScore: number
  bestScore: number | null
  cards: number
  correct: number
  solvedOnClue: number[]
  wrongGuesses: number
  timeMs: number
  fastestSolveMs: number | null
  longestRun: number
  byType: RoundTally['byType']
  timesOfDay: Partial<Record<TimeOfDay, number>>
  setups: Record<string, number>
}

export type ModeStats = {
  runs: number
  daysPlayed: number
  averageScore: number | null
  bestScore: { score: number; dateKey: string } | null
  last30Average: number | null
  /** Last 12 months: average score, and the longest run (for Endurance). */
  months: Array<{ month: string; averageScore: number | null; longestRun: number }>
  accuracy: number | null
  averageClues: number | null
  solvedOnClue: number[]
  firstClueRate: number | null
  averageTimeMs: number | null
  averageTimePerCardMs: number | null
  fastestSolveMs: number | null
  averageWrongGuesses: number | null
  cleanDays: number
  usualTimeOfDay: TimeOfDay | null
  bestWeekday: { weekday: number; average: number } | null
  longestRun: number
  averageRunLength: number | null
  byType: RoundTally['byType']
  /** Most played setup and its share of runs; Dailies have none. */
  favouriteSetup: { key: string; runs: number; share: number } | null
}

export type DailyExtras = {
  daysSinceFirst: number
  currentStreak: number
  bestStreak: number
  restDaysUsed: number
  perfectDays: number
}

const DAY_MS = 86_400_000
const dayNumber = (dateKey: string) => Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS)
const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : null)

export function statsDayFromDaily(summary: DailySummary): StatsDay {
  // Completion time on the player's own clock, from the offset saved with the Daily.
  const local = new Date(Date.parse(summary.completedAt) + (summary.tzOffsetMin ?? 0) * 60_000)
  const scored = summary.score != null
  return {
    dateKey: summary.dateKey,
    weekday: local.getUTCDay(),
    runs: 1,
    scoredRuns: scored ? 1 : 0,
    totalScore: summary.score ?? 0,
    bestScore: summary.score,
    cards: summary.cardCount,
    correct: summary.correctCount,
    solvedOnClue: summary.solvedOnClue,
    wrongGuesses: summary.wrongGuesses,
    timeMs: summary.timeMs,
    fastestSolveMs: summary.fastestSolveMs,
    longestRun: summary.correctCount,
    byType: summary.byType,
    timesOfDay: { [timeOfDay(local.getUTCHours())]: 1 },
    setups: {}
  }
}

export function statsDayFromTrend(day: TrendDay): StatsDay {
  return {
    dateKey: day.dateKey,
    weekday: new Date(`${day.dateKey}T00:00:00Z`).getUTCDay(),
    runs: day.runs,
    scoredRuns: day.runs,
    totalScore: day.totalScore,
    bestScore: day.bestScore,
    cards: day.cards,
    correct: day.correct,
    solvedOnClue: day.solvedOnClue,
    wrongGuesses: day.wrongGuesses,
    timeMs: day.timeMs,
    fastestSolveMs: day.fastestSolveMs,
    longestRun: day.longestRun,
    byType: day.byType,
    timesOfDay: day.timesOfDay,
    setups: day.setups ?? {}
  }
}

const sum = (days: StatsDay[], pick: (day: StatsDay) => number) =>
  days.reduce((total, day) => total + pick(day), 0)

export function computeModeStats(input: StatsDay[], todayKey = dailyDateKey()): ModeStats {
  const days = [...input].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const runs = sum(days, (day) => day.runs)
  const scoredRuns = sum(days, (day) => day.scoredRuns)
  const today = dayNumber(todayKey)
  const recent = days.filter((day) => today - dayNumber(day.dateKey) < 30)

  let best: { score: number; dateKey: string } | null = null
  for (const day of days) {
    if (day.bestScore != null && (best == null || day.bestScore > best.score)) {
      best = { score: day.bestScore, dateKey: day.dateKey }
    }
  }

  const byMonth = new Map<string, StatsDay[]>()
  for (const day of days) {
    const month = day.dateKey.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), day])
  }

  const solvedOnClue: number[] = []
  for (const day of days) {
    day.solvedOnClue.forEach((count, index) => {
      solvedOnClue[index] = (solvedOnClue[index] ?? 0) + count
    })
  }
  const solved = solvedOnClue.reduce((total, count) => total + count, 0)
  const cluesUsed = solvedOnClue.reduce((total, count, index) => total + count * (index + 1), 0)
  const cards = sum(days, (day) => day.cards)
  const correct = sum(days, (day) => day.correct)
  const fastest = days.map((day) => day.fastestSolveMs).filter((ms): ms is number => ms != null)

  const slots = new Map<TimeOfDay, number>()
  for (const day of days) {
    for (const [slot, count] of Object.entries(day.timesOfDay) as Array<[TimeOfDay, number]>) {
      slots.set(slot, (slots.get(slot) ?? 0) + count)
    }
  }
  const usual = [...slots.entries()].sort((a, b) => b[1] - a[1])[0]

  const weekdays = new Map<number, StatsDay[]>()
  for (const day of days) {
    if (day.scoredRuns > 0) weekdays.set(day.weekday, [...(weekdays.get(day.weekday) ?? []), day])
  }
  // A weekday needs two days of play before it can be "best", or one lucky day wins.
  const bestWeekday = [...weekdays.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([weekday, list]) => ({
      weekday,
      average: sum(list, (day) => day.totalScore) / sum(list, (day) => day.scoredRuns)
    }))
    .sort((a, b) => b.average - a.average)[0]

  const byType: ModeStats['byType'] = { character: [0, 0], place: [0, 0] }
  for (const day of days) {
    for (const type of ['character', 'place'] as const) {
      byType[type][0] += day.byType?.[type]?.[0] ?? 0
      byType[type][1] += day.byType?.[type]?.[1] ?? 0
    }
  }

  const setups = new Map<string, number>()
  for (const day of days) {
    for (const [key, count] of Object.entries(day.setups)) setups.set(key, (setups.get(key) ?? 0) + count)
  }
  const favourite = [...setups.entries()].sort((a, b) => b[1] - a[1])[0]
  const setupRuns = [...setups.values()].reduce((total, count) => total + count, 0)

  return {
    runs,
    daysPlayed: days.length,
    averageScore: ratio(sum(days, (day) => day.totalScore), scoredRuns),
    bestScore: best,
    last30Average: ratio(sum(recent, (day) => day.totalScore), sum(recent, (day) => day.scoredRuns)),
    months: [...byMonth.entries()].slice(-12).map(([month, list]) => ({
      month,
      averageScore: ratio(sum(list, (day) => day.totalScore), sum(list, (day) => day.scoredRuns)),
      longestRun: Math.max(...list.map((day) => day.longestRun))
    })),
    accuracy: ratio(correct, cards),
    averageClues: ratio(cluesUsed, solved),
    solvedOnClue,
    firstClueRate: solved > 0 ? (solvedOnClue[0] ?? 0) / solved : null,
    averageTimeMs: ratio(sum(days, (day) => day.timeMs), runs),
    averageTimePerCardMs: ratio(sum(days, (day) => day.timeMs), cards),
    fastestSolveMs: fastest.length > 0 ? Math.min(...fastest) : null,
    averageWrongGuesses: ratio(sum(days, (day) => day.wrongGuesses), runs),
    cleanDays: days.filter((day) => day.wrongGuesses === 0).length,
    usualTimeOfDay: usual ? usual[0] : null,
    bestWeekday: bestWeekday ?? null,
    longestRun: days.reduce((top, day) => Math.max(top, day.longestRun), 0),
    averageRunLength: ratio(correct, runs),
    byType,
    favouriteSetup: favourite
      ? { key: favourite[0], runs: favourite[1], share: favourite[1] / setupRuns }
      : null
  }
}

export function computeDailyExtras(progress: DailyProgress, todayKey = dailyDateKey()): DailyExtras {
  const days = Object.values(progress.summaries)
  const streaks = computeDailyStreaks(
    days.map((day) => day.dateKey),
    todayKey
  )
  const first = days.map((day) => day.dateKey).sort()[0]
  return {
    daysSinceFirst: first ? dayNumber(todayKey) - dayNumber(first) + 1 : 0,
    currentStreak: streaks.current,
    bestStreak: Math.max(progress.bestStreak, streaks.best),
    restDaysUsed: streaks.restDaysUsed,
    perfectDays: days.filter((day) => day.cardCount > 0 && day.correctCount === day.cardCount).length
  }
}

/** The card missed most often. Ties go to the one answered right least. */
export function findNemesis(entities: EntityMastery[]): EntityMastery | null {
  return (
    entities
      .filter((entity) => entity.missCount > 0)
      .sort(
        (a, b) =>
          b.missCount - a.missCount ||
          a.correctCount - b.correctCount ||
          a.entityName.localeCompare(b.entityName)
      )[0] ?? null
  )
}
