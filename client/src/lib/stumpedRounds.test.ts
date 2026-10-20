import { describe, expect, it } from 'vitest'
import { stumpedRoundsLine } from './stumpedRounds'

describe('stumpedRoundsLine', () => {
  it('is empty when every round was solved', () => {
    expect(stumpedRoundsLine([])).toBeNull()
    expect(stumpedRoundsLine(undefined)).toBeNull()
  })

  it('names a single round', () => {
    expect(stumpedRoundsLine([{ roundNumber: 3, answer: 'Amnon' }])).toBe(
      'Round 3 (Amnon) stumped everyone.'
    )
  })

  it('names two or three rounds', () => {
    expect(
      stumpedRoundsLine([
        { roundNumber: 2, answer: 'Othniel' },
        { roundNumber: 5, answer: 'Jabez' }
      ])
    ).toBe('Othniel (round\u00a02) and Jabez (round\u00a05) stumped everyone.')
    expect(
      stumpedRoundsLine([
        { roundNumber: 1, answer: 'Annas' },
        { roundNumber: 2, answer: 'Othniel' },
        { roundNumber: 5, answer: 'Jabez' }
      ])
    ).toBe('Annas (round\u00a01), Othniel (round\u00a02) and Jabez (round\u00a05) stumped everyone.')
  })

  it('just counts when there are more than three', () => {
    const rounds = [1, 2, 3, 4].map((roundNumber) => ({ roundNumber, answer: `A${roundNumber}` }))
    expect(stumpedRoundsLine(rounds)).toBe('4 rounds stumped everyone.')
  })
})
