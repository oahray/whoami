import { describe, expect, it } from 'vitest'
import {
  computeDailyExtras,
  computeModeStats,
  findNemesis,
  statsDayFromDaily,
  statsDayFromTrend
} from './soloStats'
import type { DailyProgress, DailySummary } from './dailySolo'
import type { EntityMastery } from './soloMastery'
import type { TrendDay } from './soloTrends'

const daily = (dateKey: string, over: Partial<DailySummary> = {}): DailySummary => ({
  v: 1,
  challengeId: `${dateKey}-v1`,
  dateKey,
  completedAt: `${dateKey}T08:30:00Z`,
  tzOffsetMin: 60,
  scoringVersion: 1,
  score: 6000,
  cardCount: 10,
  correctCount: 8,
  solvedOnClue: [4, 2, 2],
  wrongGuesses: 2,
  timeMs: 200_000,
  fastestSolveMs: 5_000,
  byType: { character: [8, 10], place: [0, 0] },
  ...over
})

const progress = (days: DailySummary[], bestStreak = 0): DailyProgress => ({
  currentStreak: 0,
  bestStreak,
  lastCompletedDate: days.at(-1)?.dateKey ?? null,
  results: {},
  summaries: Object.fromEntries(days.map((d) => [d.challengeId, d]))
})

describe('Daily stats', () => {
  const days = [
    // Thursday 1 Oct to Saturday 3 Oct, then a rest day, then Monday 5 Oct.
    daily('2026-10-01', { score: 5000 }),
    daily('2026-10-02', { score: 7000, correctCount: 10, solvedOnClue: [6, 4], wrongGuesses: 0, fastestSolveMs: 3_100 }),
    daily('2026-10-03', { score: 6000, completedAt: '2026-10-03T21:30:00Z' }),
    daily('2026-10-05', { score: 9000, completedAt: '2026-10-05T19:00:00Z' })
  ]
  const stats = computeModeStats(days.map(statsDayFromDaily), '2026-10-05')

  it('counts the habit, including rest days and perfect days', () => {
    expect(computeDailyExtras(progress(days, 2), '2026-10-05')).toEqual({
      daysSinceFirst: 5,
      currentStreak: 4,
      bestStreak: 4,
      restDaysUsed: 1,
      perfectDays: 1
    })
    expect(stats).toMatchObject({ runs: 4, daysPlayed: 4, cleanDays: 1 })
  })

  it('averages scores and finds the best day', () => {
    expect(stats.averageScore).toBe(6750)
    expect(stats.bestScore).toEqual({ score: 9000, dateKey: '2026-10-05' })
    expect(stats.months).toEqual([{ month: '2026-10', averageScore: 6750, longestRun: 10 }])
  })

  it('works out clue use from the per-clue counts', () => {
    // Solved: [4+6+4+4, 2+4+2+2, 2+0+2+2] = [18, 10, 6] -> 34 cards, 18 + 20 + 18 = 56 clues.
    expect(stats.solvedOnClue).toEqual([18, 10, 6])
    expect(stats.averageClues).toBeCloseTo(56 / 34)
    expect(stats.firstClueRate).toBeCloseTo(18 / 34)
    expect(stats.accuracy).toBeCloseTo(34 / 40)
  })

  it('reports speed and guessing', () => {
    expect(stats.averageTimeMs).toBe(200_000)
    expect(stats.averageTimePerCardMs).toBe(20_000)
    expect(stats.fastestSolveMs).toBe(3_100)
    expect(stats.averageWrongGuesses).toBe(1.5)
  })

  it('uses the player clock for time of day', () => {
    // 08:30 UTC at +1 is 09:30 local, twice; 22:30 and 20:00 local once each.
    expect(stats.usualTimeOfDay).toBe('morning')
  })

  it('needs two days on a weekday before naming a best weekday', () => {
    expect(stats.bestWeekday).toBeNull()
    const more = computeModeStats(
      [...days, daily('2026-10-08', { score: 8000 }), daily('2026-10-15', { score: 8000 })].map(statsDayFromDaily),
      '2026-10-15'
    )
    expect(more.bestWeekday).toEqual({ weekday: 4, average: (5000 + 8000 + 8000) / 3 })
  })

  it('keeps an older stored best streak', () => {
    expect(computeDailyExtras(progress(days, 12), '2026-10-05').bestStreak).toBe(12)
  })

  it('handles no play at all', () => {
    expect(computeModeStats([], '2026-10-05')).toMatchObject({
      runs: 0,
      averageScore: null,
      bestScore: null,
      accuracy: null,
      usualTimeOfDay: null,
      averageRunLength: null
    })
  })
})

describe('Classic and Endurance stats', () => {
  const trend = (dateKey: string, over: Partial<TrendDay> = {}): TrendDay => ({
    v: 1,
    variation: 'endurance',
    dateKey,
    runs: 2,
    totalScore: 9000,
    bestScore: 6000,
    cards: 14,
    correct: 12,
    solvedOnClue: [6, 6],
    wrongGuesses: 3,
    timeMs: 240_000,
    fastestSolveMs: 2_500,
    longestRun: 8,
    byType: { character: [12, 14], place: [0, 0] },
    timesOfDay: { evening: 2 },
    setups: { 'any|all|30000|5000': 2 },
    ...over
  })

  it('averages per run, not per day', () => {
    const stats = computeModeStats(
      [trend('2026-09-30', { runs: 1, totalScore: 3000, bestScore: 3000, correct: 4, longestRun: 4 }), trend('2026-10-01')].map(
        statsDayFromTrend
      ),
      '2026-10-01'
    )
    expect(stats.runs).toBe(3)
    expect(stats.averageScore).toBe(4000)
    expect(stats.bestScore).toEqual({ score: 6000, dateKey: '2026-10-01' })
    expect(stats.averageTimeMs).toBe(160_000)
    expect(stats.longestRun).toBe(8)
    expect(stats.averageRunLength).toBeCloseTo(16 / 3)
    expect(stats.months.map((m) => [m.month, m.longestRun])).toEqual([
      ['2026-09', 4],
      ['2026-10', 8]
    ])
  })

  it('adds up time-of-day counts across days', () => {
    const stats = computeModeStats(
      [trend('2026-10-01', { timesOfDay: { morning: 1, night: 1 } }), trend('2026-10-02', { timesOfDay: { night: 2 } })].map(
        statsDayFromTrend
      ),
      '2026-10-02'
    )
    expect(stats.usualTimeOfDay).toBe('night')
  })
})

describe('favourite setup', () => {
  const day = (dateKey: string, setups: Record<string, number>): TrendDay => ({
    v: 1, variation: 'challenge', dateKey, runs: Object.values(setups).reduce((a, b) => a + b, 0), totalScore: 0, bestScore: 0,
    cards: 0, correct: 0, solvedOnClue: [], wrongGuesses: 0, timeMs: 0, fastestSolveMs: null, longestRun: 0,
    byType: { character: [0, 0], place: [0, 0] }, timesOfDay: {}, setups
  })

  it('picks the most played setup across days and its share', () => {
    const stats = computeModeStats(
      [day('2026-10-01', { a: 2, b: 1 }), day('2026-10-02', { b: 3 })].map(statsDayFromTrend),
      '2026-10-02'
    )
    expect(stats.favouriteSetup).toEqual({ key: 'b', runs: 4, share: 4 / 6 })
  })

  it('has none for Dailies', () => {
    expect(computeModeStats([], '2026-10-02').favouriteSetup).toBeNull()
  })
})

describe('findNemesis', () => {
  const entity = (entityName: string, missCount: number, correctCount: number): EntityMastery => ({
    datasetId: 'bible',
    entityId: entityName.toLowerCase(),
    entityName,
    encounters: missCount + correctCount,
    correctCount,
    firstClueCorrectCount: 0,
    missCount,
    lastCorrect: true,
    lastEncounteredAt: '2026-10-20T12:00:00Z',
    state: 'learning'
  })

  it('picks the most missed, then the one answered right least', () => {
    expect(findNemesis([entity('Ruth', 2, 1), entity('Annas', 4, 3), entity('Othniel', 4, 1)])?.entityName).toBe(
      'Othniel'
    )
  })

  it('has no nemesis without misses', () => {
    expect(findNemesis([entity('Ruth', 0, 5)])).toBeNull()
  })
})
