import { describe, expect, it } from 'vitest'
import { findStumpedRounds } from './stumpedRounds.js'

describe('findStumpedRounds', () => {
  it('lists rounds with no correct guesses, in order', () => {
    expect(
      findStumpedRounds([
        { roundNumber: 1, entity: { name: 'Annas' }, correctGuesses: [{ playerId: 'a' }] },
        { roundNumber: 2, entity: { name: 'Othniel' }, correctGuesses: [] },
        { roundNumber: 3, entity: { name: 'Amnon' }, correctGuesses: [] }
      ])
    ).toEqual([
      { roundNumber: 2, answer: 'Othniel' },
      { roundNumber: 3, answer: 'Amnon' }
    ])
  })

  it('returns nothing when every round was solved or there is no history', () => {
    expect(findStumpedRounds([{ roundNumber: 1, entity: { name: 'Ruth' }, correctGuesses: [{}] }])).toEqual([])
    expect(findStumpedRounds(undefined)).toEqual([])
  })
})
