import { describe, expect, it } from 'vitest'
import { buildClueBaselineMap, isClueDirty, toClueBaseline } from './clueDirty'

describe('clueDirty', () => {
  it('treats new clues as dirty', () => {
    expect(
      isClueDirty(
        { id: null, text: 'New', citations: '', difficulty: 'easy' },
        {}
      )
    ).toBe(true)
  })

  it('skips unchanged existing clues', () => {
    const clue = {
      id: 'c1',
      text: 'Led Israel',
      citations: 'Exodus 3',
      difficulty: 'easy' as const
    }
    const baseline = buildClueBaselineMap([clue])
    expect(isClueDirty(clue, baseline)).toBe(false)
  })

  it('flags text, citations, or difficulty changes', () => {
    const baseline = buildClueBaselineMap([
      { id: 'c1', text: 'Led Israel', citations: 'Exodus 3', difficulty: 'easy' }
    ])

    expect(
      isClueDirty(
        { id: 'c1', text: 'Led Israel out', citations: 'Exodus 3', difficulty: 'easy' },
        baseline
      )
    ).toBe(true)
    expect(
      isClueDirty(
        { id: 'c1', text: 'Led Israel', citations: 'Exodus 4', difficulty: 'easy' },
        baseline
      )
    ).toBe(true)
    expect(
      isClueDirty(
        { id: 'c1', text: 'Led Israel', citations: 'Exodus 3', difficulty: 'hard' },
        baseline
      )
    ).toBe(true)
  })

  it('normalizes empty citations and null difficulty', () => {
    expect(toClueBaseline({ text: 'A', citations: '', difficulty: null })).toEqual({
      text: 'A',
      citations: '',
      difficulty: null
    })
  })
})
