import { describe, expect, it } from 'vitest'
import { IN_PERSON_MASK_PLACEHOLDER } from './inPersonMask'

describe('inPersonMask', () => {
  it('uses five asterisks for every hidden answer', () => {
    expect(IN_PERSON_MASK_PLACEHOLDER).toBe('*****')
    expect(IN_PERSON_MASK_PLACEHOLDER).toHaveLength(5)
  })
})
