import { describe, expect, it } from 'vitest'
import { dailyCardSeed } from './inPersonPlay.js'
import { seededShuffle } from './shuffle.js'

describe('dailyCardSeed', () => {
  it('namespaces the challenge id with the entity id', () => {
    expect(dailyCardSeed('2026-10-02-v3', 'ent-a')).toBe('2026-10-02-v3:ent-a')
  })

  it('yields a stable shuffle after sorting by clue id', () => {
    const clues = [
      { id: 'c-3', text: 'C' },
      { id: 'c-1', text: 'A' },
      { id: 'c-2', text: 'B' },
      { id: 'c-4', text: 'D' }
    ]
    const seed = dailyCardSeed('2026-10-02-v3', 'ent-a')
    const pick = () => {
      const stable = [...clues].sort((a, b) => a.id.localeCompare(b.id))
      return seededShuffle(stable, seed)
        .slice(0, 3)
        .map((c) => c.id)
    }
    expect(pick()).toEqual(pick())
  })
})
