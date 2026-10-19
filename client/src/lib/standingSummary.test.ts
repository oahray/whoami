import { describe, expect, it } from 'vitest'
import { standingSummary, type RankedEntry } from './standingSummary'

const e = (playerId: string, nickname: string, score: number, rank: number, tied = false): RankedEntry => ({
  playerId,
  nickname,
  score,
  rank,
  tied
})

describe('standingSummary', () => {
  it('says nobody has scored before any points', () => {
    expect(standingSummary([e('a', 'Ada', 0, 1, true), e('b', 'Josh', 0, 1, true)], 'a')).toBe('No one has scored yet')
  })

  it('shows your lead over the runner-up', () => {
    const ranked = [e('t', 'Tobi', 275, 1), e('j', 'Josh', 264, 2), e('a', 'Ada', 232, 3)]
    expect(standingSummary(ranked, 't')).toBe('You lead by 11 · 275 pts')
  })

  it('shows how far behind the leader you are', () => {
    const ranked = [e('t', 'Tobi', 275, 1), e('j', 'Josh', 264, 2), e('a', 'Ada', 232, 3)]
    expect(standingSummary(ranked, 'a')).toBe("43 behind Tobi · You're #3")
  })

  it('handles a shared lead', () => {
    const ranked = [e('t', 'Tobi', 100, 1, true), e('a', 'Ada', 100, 1, true), e('j', 'Josh', 0, 3)]
    expect(standingSummary(ranked, 't')).toBe("You're tied for the lead · 100 pts")
    expect(standingSummary(ranked, 'j')).toBe("100 behind the leaders · You're #3")
  })

  it('marks a tie below the lead', () => {
    const ranked = [e('t', 'Tobi', 300, 1), e('a', 'Ada', 120, 2, true), e('j', 'Josh', 120, 2, true)]
    expect(standingSummary(ranked, 'j')).toBe("180 behind Tobi · You're #2 (tied)")
  })

  it('falls back to the leader when you are not on the board', () => {
    expect(standingSummary([e('t', 'Tobi', 1, 1)], null)).toBe('Tobi leads with 1 pt')
  })
})
