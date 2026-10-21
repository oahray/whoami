import { describe, expect, it } from 'vitest'
import { soloStatsShareFileName, statsShareContent } from './exportSoloStatsPng'
import { computeModeStats } from './soloStats'

const stats = {
  ...computeModeStats([], '2026-10-21'),
  runs: 18,
  daysPlayed: 6,
  averageScore: 6750,
  bestScore: { score: 8200, dateKey: '2026-10-14' },
  accuracy: 0.8,
  firstClueRate: 0.5,
  averageClues: 1.66,
  longestRun: 17,
  averageRunLength: 11
}

describe('stats share card', () => {
  it('shows the Daily habit numbers', () => {
    const content = statsShareContent({
      mode: 'daily',
      stats: { ...stats, daysPlayed: 56 },
      daily: { daysSinceFirst: 58, currentStreak: 56, bestStreak: 60, restDaysUsed: 2, perfectDays: 12 },
      found: 87,
      mastered: 12
    })
    expect(content.tiles.map((tile) => `${tile.label} ${tile.value}`)).toEqual([
      'PLAYED 56',
      'STREAK 56',
      'BEST STREAK 60',
      'AVERAGE 6,750',
      'BEST 8,200',
      'ON CLUE 1 50%'
    ])
    expect(content.notes).toEqual(['12 perfect Dailies  ·  80% of cards right', '87 cards found  ·  12 mastered'])
  })

  it('adds the usual setup for Classic and Endurance', () => {
    const classic = statsShareContent({ mode: 'challenge', stats, found: 1, mastered: 0, usualSetup: { what: 'Characters, Easy + Medium', timing: '30s per card, new clue every 5s' } })
    expect(classic.tiles.map((tile) => tile.label)).toEqual(['RUNS', 'AVERAGE', 'BEST', 'CARDS RIGHT', 'ON CLUE 1', 'CLUES / CARD'])
    expect(classic.notes).toEqual([
      'Usual setup: Characters, Easy + Medium',
      '30s per card, new clue every 5s',
      '1 card found  ·  0 mastered'
    ])
    const endurance = statsShareContent({ mode: 'endurance', stats, found: 3, mastered: 1 })
    expect(endurance.tiles.slice(0, 3).map((tile) => `${tile.label} ${tile.value}`)).toEqual([
      'RUNS 18',
      'LONGEST RUN 17',
      'AVERAGE RUN 11.0'
    ])
  })

  it('names files by mode and day', () => {
    expect(soloStatsShareFileName('challenge', '2026-10-21')).toBe('whoami-solo-classic-stats-2026-10-21.png')
    expect(soloStatsShareFileName('daily', '2026-10-21')).toBe('whoami-solo-daily-stats-2026-10-21.png')
  })
})
