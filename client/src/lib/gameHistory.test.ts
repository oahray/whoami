import { describe, expect, it } from 'vitest'
import {
  formatAvgCluesWhenSolved,
  hasGameEfficiency,
  type GameHistoryEntry
} from './gameHistory'

const baseEntry: GameHistoryEntry = {
  id: 'g1',
  gameNumber: 1,
  endedAt: Date.now(),
  totalRounds: 10,
  scoreboard: []
}

describe('gameHistory efficiency helpers', () => {
  it('treats legacy entries without efficiency as ranks-only', () => {
    expect(hasGameEfficiency(baseEntry)).toBe(false)
    expect(hasGameEfficiency({ ...baseEntry, efficiency: undefined })).toBe(false)
  })

  it('accepts a well-formed efficiency rollup', () => {
    expect(
      hasGameEfficiency({
        ...baseEntry,
        efficiency: {
          roundsPlayed: 10,
          roundsSolved: 8,
          firstClueSolves: 3,
          avgCluesWhenSolved: 2.4
        }
      })
    ).toBe(true)
  })

  it('formats average clues for the share card', () => {
    expect(formatAvgCluesWhenSolved(null)).toBe('—')
    expect(formatAvgCluesWhenSolved(2)).toBe('2')
    expect(formatAvgCluesWhenSolved(2.4)).toBe('2.4')
  })
})
