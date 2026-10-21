import { describe, expect, it } from 'vitest'
import { crossedMilestone, pickMoment, type MomentSnapshot } from './soloMoments'

const snap = (over: Partial<MomentSnapshot> = {}): MomentSnapshot => ({
  found: 0,
  mastered: 0,
  firstClue: 0,
  streak: 0,
  ...over
})

describe('crossedMilestone', () => {
  it('finds a fixed milestone crossed by the run', () => {
    expect(crossedMilestone(6, 7, [7, 30])).toBe(7)
    expect(crossedMilestone(7, 8, [7, 30])).toBeNull()
    expect(crossedMilestone(9, 12, [10, 25])).toBe(10)
  })

  it('keeps going every step past the fixed list', () => {
    expect(crossedMilestone(99, 100, [1, 10, 25, 50], 50)).toBe(100)
    expect(crossedMilestone(100, 149, [1, 10, 25, 50], 50)).toBeNull()
    expect(crossedMilestone(149, 150, [1, 10, 25, 50], 50)).toBe(150)
  })

  it('reports the highest when a run crosses two at once', () => {
    expect(crossedMilestone(8, 26, [10, 25, 50])).toBe(25)
  })

  it('ignores runs that did not go up', () => {
    expect(crossedMilestone(10, 10, [10])).toBeNull()
    expect(crossedMilestone(12, 3, [10])).toBeNull()
  })
})

describe('pickMoment', () => {
  it('stays quiet when nothing was crossed', () => {
    expect(pickMoment(snap({ found: 11 }), snap({ found: 12 }), { perfectDaily: false })).toBeNull()
  })

  it('celebrates the streak first', () => {
    expect(
      pickMoment(snap({ streak: 59, found: 49 }), snap({ streak: 60, found: 50 }), { perfectDaily: true })
    ).toEqual({ kind: 'streak', text: '60-day Daily streak!' })
  })

  it('then a perfect Daily', () => {
    expect(pickMoment(snap({ found: 49 }), snap({ found: 50 }), { perfectDaily: true })?.text).toBe(
      'A perfect Daily: every card right!'
    )
  })

  it('then mastered, found and first-clue milestones', () => {
    expect(pickMoment(snap(), snap({ mastered: 1, found: 10 }), { perfectDaily: false })?.text).toBe(
      'Your first card mastered!'
    )
    expect(pickMoment(snap({ mastered: 49 }), snap({ mastered: 50 }), { perfectDaily: false })?.text).toBe(
      '50 cards mastered!'
    )
    expect(pickMoment(snap({ found: 24 }), snap({ found: 25 }), { perfectDaily: false })?.text).toBe(
      '25 cards found!'
    )
    expect(pickMoment(snap({ firstClue: 99 }), snap({ firstClue: 100 }), { perfectDaily: false })?.text).toBe(
      '100 first-clue solves!'
    )
  })

  it('starts from scratch after progress is cleared', () => {
    expect(pickMoment(snap(), snap({ found: 10 }), { perfectDaily: false })?.text).toBe('10 cards found!')
  })
})
