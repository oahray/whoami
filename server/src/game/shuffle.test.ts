import { describe, expect, it } from 'vitest'
import { pickSeededSample, seededShuffle } from './shuffle.js'

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    expect(seededShuffle(input, 'day-1')).toEqual(seededShuffle(input, 'day-1'))
    expect(seededShuffle(input, 'day-1')).not.toEqual(seededShuffle(input, 'day-2'))
  })
})

describe('pickSeededSample', () => {
  it('returns a stable random-looking sample for a seed', () => {
    const items = Array.from({ length: 40 }, (_, index) => `id-${index}`)

    const first = pickSeededSample(items, 10, '2026-10-02-v3')
    const second = pickSeededSample(items, 10, '2026-10-02-v3')
    const otherDay = pickSeededSample(items, 10, '2026-10-03-v3')

    expect(first).toEqual(second)
    expect(first).toHaveLength(10)
    expect(new Set(first).size).toBe(10)
    expect(first).not.toEqual(otherDay)
    // Should not just be the head of the input list.
    expect(first).not.toEqual(items.slice(0, 10))
  })
})
