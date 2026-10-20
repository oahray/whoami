import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeDailyStreaks,
  DAILY_DETAIL_DAYS,
  getActiveDailyStreak,
  getBestDailyStreak,
  getDailyBestScore,
  hydrateDailyCardCache,
  formatDailyCountdown,
  loadDailyProgress,
  msUntilNextDaily,
  saveDailyResult,
  summarizeDailyResult,
  type DailyChallenge
} from './dailySolo'
import {
  peekCachedDailyCard,
  resetInPersonCardCacheForTests
} from './inPersonCardFetch'
import type { SoloRecord, SoloRoundPerformance } from './soloSession'

function record(): SoloRecord {
  return {
    datasetId: 'ds-1',
    difficulty: [],
    entityType: 'all',
    variation: 'daily',
    roundDurationMs: 30_000,
    clueRevealIntervalMs: 5_000,
    correctCount: 8,
    activeElapsedMs: 100_000,
    score: 6400,
    achievedAt: '2026-10-01T12:00:00Z'
  }
}

describe('dailySolo', () => {
  beforeEach(() => {
    localStorage.clear()
    resetInPersonCardCacheForTests()
  })

  it('increments consecutive daily completions exactly once', () => {
    saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: record()
    })
    const second = saveDailyResult({
      challengeId: '2026-10-02-v1',
      dateKey: '2026-10-02',
      completedAt: '2026-10-02T12:00:00Z',
      record: record()
    })
    expect(second.currentStreak).toBe(2)
    expect(loadDailyProgress().bestStreak).toBe(2)
  })

  it('returns the highest completed Daily score', () => {
    expect(getDailyBestScore(loadDailyProgress())).toBeNull()
    saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: { ...record(), score: 6400 }
    })
    const progress = saveDailyResult({
      challengeId: '2026-10-02-v1',
      dateKey: '2026-10-02',
      completedAt: '2026-10-02T12:00:00Z',
      record: { ...record(), score: 7200 }
    })

    expect(getDailyBestScore(progress)).toBe(7200)
  })

  it('keeps yesterday’s streak alive, covers one missed day, and clears two', () => {
    const progress = saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: record()
    })

    expect(getActiveDailyStreak(progress, '2026-10-01')).toBe(1)
    expect(getActiveDailyStreak(progress, '2026-10-02')).toBe(1)
    expect(getActiveDailyStreak(progress, '2026-10-03')).toBe(1)
    expect(getActiveDailyStreak(progress, '2026-10-04')).toBe(0)
    expect(progress.bestStreak).toBe(1)
  })

  it('hydrates the Daily card cache from the challenge snapshot', () => {
    const challenge: DailyChallenge = {
      challengeId: '2026-10-02-v1',
      challengeVersion: 1,
      dateKey: '2026-10-02',
      datasetId: 'ds-1',
      datasetName: 'Bible',
      difficulty: 'any',
      entityType: 'all',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 5_000,
      entityIds: ['ent-1'],
      cards: {
        'ent-1': {
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [{ order: 1, text: 'Frozen clue', citations: null }]
        }
      },
      scoringVersion: 1,
      scoringRules: {
        basePoints: 1000,
        additionalCluePenalty: 150,
        elapsedSecondPenalty: 10,
        incorrectGuessPenalty: 100,
        minimumCorrectScore: 100
      }
    }

    hydrateDailyCardCache(challenge)

    expect(peekCachedDailyCard('2026-10-02-v1', 'ent-1')?.clues[0]?.text).toBe('Frozen clue')
  })
})

describe('next Daily countdown', () => {
  it('counts down to the next UTC midnight after the challenge day', () => {
    const now = Date.parse('2026-10-20T20:48:00Z')
    expect(msUntilNextDaily('2026-10-20', now)).toBe((3 * 60 + 12) * 60_000)
    expect(msUntilNextDaily('2026-10-19', now)).toBe(0)
  })

  it('formats short, readable labels', () => {
    expect(formatDailyCountdown((3 * 60 + 12) * 60_000)).toBe('3h 12m')
    expect(formatDailyCountdown(3 * 3_600_000)).toBe('3h')
    expect(formatDailyCountdown(42 * 60_000)).toBe('42m')
    expect(formatDailyCountdown(41 * 60_000 + 1)).toBe('42m')
    expect(formatDailyCountdown(30_000)).toBe('under a minute')
  })
})

describe('Daily rest days', () => {
  const oct = (day: number) => `2026-10-${String(day).padStart(2, '0')}`
  const days = (...list: number[]) => list.map(oct)

  it('counts consecutive days', () => {
    expect(computeDailyStreaks(days(1, 2, 3), oct(3))).toMatchObject({ current: 3, best: 3, restDay: null })
  })

  it('bridges one missed day without counting it', () => {
    expect(computeDailyStreaks(days(1, 2, 4), oct(4))).toEqual({
      current: 3,
      best: 3,
      restDaysUsed: 1,
      restDay: { usedOn: oct(3), nextAvailableOn: oct(10), coversYesterday: false }
    })
  })

  it('restores a 7-day streak broken by one missed day', () => {
    const history = days(1, 2, 3, 4, 5, 6, 7, 9)
    expect(computeDailyStreaks(history, oct(9)).current).toBe(8)
  })

  it('keeps the streak alive today when only yesterday was missed', () => {
    expect(computeDailyStreaks(days(1, 2), oct(4))).toEqual({
      current: 2,
      best: 2,
      restDaysUsed: 0,
      restDay: { usedOn: oct(3), nextAvailableOn: oct(10), coversYesterday: true }
    })
  })

  it('allows only one rest day in any 7 days', () => {
    // Missed the 3rd and the 6th: the second miss is too soon.
    const info = computeDailyStreaks(days(1, 2, 4, 5, 7), oct(7))
    expect(info.current).toBe(1)
    expect(info.best).toBe(4)
  })

  it('allows another rest day 7 days after the last one', () => {
    // Missed the 3rd and the 10th.
    expect(computeDailyStreaks(days(1, 2, 4, 5, 6, 7, 8, 9, 11), oct(11))).toMatchObject({
      current: 9,
      restDaysUsed: 2
    })
  })

  it('never bridges two missed days in a row', () => {
    expect(computeDailyStreaks(days(1, 2, 5), oct(5)).current).toBe(1)
    expect(computeDailyStreaks(days(1, 2), oct(5)).current).toBe(0)
  })

  it('stops reporting the rest day once another one is available', () => {
    expect(computeDailyStreaks(days(1, 2, 4, 5, 6, 7, 8, 9, 10), oct(10)).restDay).toBeNull()
  })

  it('never lowers a best streak stored before rest days existed', () => {
    const progress = { ...loadDailyProgress(), bestStreak: 12 }
    expect(getBestDailyStreak(progress, oct(9))).toBe(12)
  })
})

describe('Daily summaries', () => {
  beforeEach(() => localStorage.clear())

  const round = (over: Partial<SoloRoundPerformance>): SoloRoundPerformance => ({
    entityId: 'x',
    entityType: 'character',
    correct: true,
    revealedClueCount: 1,
    incorrectGuessCount: 0,
    elapsedMs: 10_000,
    score: 0,
    breakdown: { score: 0, basePoints: 0, cluePenalty: 0, timePenalty: 0, incorrectGuessPenalty: 0, bonusPoints: 0 },
    ...over
  })

  const resultOn = (dateKey: string, rounds: SoloRoundPerformance[] = [round({})]) => ({
    challengeId: `${dateKey}-v1`,
    dateKey,
    completedAt: `${dateKey}T12:00:00Z`,
    scoringVersion: 1,
    record: { ...record(), rounds }
  })

  it('summarises a played day', () => {
    const summary = summarizeDailyResult(
      resultOn('2026-10-01', [
        round({ revealedClueCount: 1, elapsedMs: 6_000 }),
        round({ revealedClueCount: 3, elapsedMs: 15_000, incorrectGuessCount: 2 }),
        round({ correct: false, revealedClueCount: 6, incorrectGuessCount: 1, entityType: 'place' }),
        round({ revealedClueCount: 1, elapsedMs: 4_000, entityType: 'place' })
      ])
    )
    expect(summary).toMatchObject({
      v: 1,
      dateKey: '2026-10-01',
      scoringVersion: 1,
      score: 6400,
      cardCount: 4,
      correctCount: 8,
      wrongGuesses: 3,
      timeMs: 100_000,
      fastestSolveMs: 4_000,
      byType: { character: [2, 2], place: [1, 2] }
    })
    expect(summary.solvedOnClue).toEqual([2, 0, 1])
  })

  it('treats rounds saved before entity types as characters', () => {
    const summary = summarizeDailyResult(resultOn('2026-10-01', [round({ entityType: undefined })]))
    expect(summary.byType).toEqual({ character: [1, 1], place: [0, 0] })
  })

  it('treats days saved before the scoring version as version 1', () => {
    const { scoringVersion: _, ...older } = resultOn('2026-10-01')
    expect(summarizeDailyResult(older).scoringVersion).toBe(1)
  })

  it('keeps round detail for 30 days and a summary forever', () => {
    saveDailyResult(resultOn('2026-08-01'))
    saveDailyResult(resultOn('2026-09-01'))
    saveDailyResult(resultOn('2026-09-30'))
    const progress = saveDailyResult(resultOn('2026-10-01'))

    expect(DAILY_DETAIL_DAYS).toBe(30)
    expect(Object.keys(progress.results).sort()).toEqual(['2026-09-30-v1', '2026-10-01-v1'])
    expect(Object.keys(progress.summaries).sort()).toEqual([
      '2026-08-01-v1',
      '2026-09-01-v1',
      '2026-09-30-v1',
      '2026-10-01-v1'
    ])
    expect(Object.keys(loadDailyProgress().summaries)).toHaveLength(4)
  })

  it('backfills summaries for history saved before they existed', () => {
    localStorage.setItem(
      'whoami-solo-daily-progress',
      JSON.stringify({
        currentStreak: 2,
        bestStreak: 2,
        lastCompletedDate: '2026-10-02',
        results: { '2026-10-01-v1': resultOn('2026-10-01'), '2026-10-02-v1': resultOn('2026-10-02') }
      })
    )
    const progress = loadDailyProgress()
    expect(Object.keys(progress.summaries)).toHaveLength(2)
    expect(getActiveDailyStreak(progress, '2026-10-02')).toBe(2)
  })

  it('does not save the same Daily twice after its detail is trimmed', () => {
    saveDailyResult(resultOn('2026-08-01'))
    saveDailyResult(resultOn('2026-10-01'))
    const again = saveDailyResult({ ...resultOn('2026-08-01'), record: { ...record(), score: 9999 } })
    expect(again.summaries['2026-08-01-v1'].score).toBe(6400)
  })

  it('still returns the new progress when storage is full', () => {
    const setItem = localStorage.setItem
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    try {
      const progress = saveDailyResult(resultOn('2026-10-01'))
      expect(progress.summaries['2026-10-01-v1'].dateKey).toBe('2026-10-01')
    } finally {
      localStorage.setItem = setItem
    }
  })
})
