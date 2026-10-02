import { describe, expect, it } from 'vitest'
import { computeGameEfficiency } from './gameEfficiency.js'

describe('computeGameEfficiency', () => {
  it('returns undefined for empty or missing history (legacy-safe)', () => {
    expect(computeGameEfficiency(undefined)).toBeUndefined()
    expect(computeGameEfficiency(null)).toBeUndefined()
    expect(computeGameEfficiency([])).toBeUndefined()
  })

  it('counts solved rounds, first-clue hits, and average clues at first solve', () => {
    const efficiency = computeGameEfficiency([
      { correctGuesses: [{ clueIndex: 0 }, { clueIndex: 2 }], clues: [{}, {}] },
      { correctGuesses: [{ clueIndex: 3 }], clues: [{}, {}, {}, {}] },
      { correctGuesses: [], clues: [{}, {}] },
      { correctGuesses: [{ clueIndex: 1 }], clues: [{}, {}] }
    ])

    expect(efficiency).toEqual({
      roundsPlayed: 4,
      roundsSolved: 3,
      firstClueSolves: 1,
      avgCluesWhenSolved: 2.3 // (1 + 4 + 2) / 3
    })
  })

  it('returns null average when nothing was solved', () => {
    expect(
      computeGameEfficiency([
        { correctGuesses: [], clues: [{}] },
        { correctGuesses: [], clues: [{}] }
      ])
    ).toEqual({
      roundsPlayed: 2,
      roundsSolved: 0,
      firstClueSolves: 0,
      avgCluesWhenSolved: null
    })
  })
})
