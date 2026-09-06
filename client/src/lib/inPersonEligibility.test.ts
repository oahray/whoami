import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchInPersonEligibility,
  getCachedEligibility,
  isDifficultySelectionPlayable,
  setCachedEligibility,
  type InPersonEligibility
} from './inPersonEligibility'

const MODES: InPersonEligibility['modes'] = {
  any: 32,
  easy: 32,
  medium: 30,
  hard: 24,
  nightmare: 12
}

describe('inPersonEligibility', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('caches by dataset and entity type only', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ modes: MODES, selectedCount: 32 })
    } as Response)

    const first = await fetchInPersonEligibility('ds-1', 'character')
    const second = await fetchInPersonEligibility('ds-1', 'character')

    expect(first.modes.easy).toBe(32)
    expect(second).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('difficulty=any')
    expect(getCachedEligibility('ds-1', 'character')?.modes.medium).toBe(30)
  })

  it('refetches when entity type changes', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const entityType = new URL(String(input), 'http://localhost').searchParams.get('entityType')
      const modes =
        entityType === 'place'
          ? { ...MODES, any: 3, easy: 3, medium: 0, hard: 0, nightmare: 0 }
          : MODES
      return { ok: true, json: async () => ({ modes }) } as Response
    })

    await fetchInPersonEligibility('ds-1', 'character')
    await fetchInPersonEligibility('ds-1', 'place')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getCachedEligibility('ds-1', 'place')?.modes.easy).toBe(3)
  })

  it('gates multi-select from per-tier modes (union / OR)', () => {
    const eligibility = { modes: MODES }
    expect(isDifficultySelectionPlayable(eligibility, [])).toBe(true)
    expect(isDifficultySelectionPlayable(eligibility, ['easy'])).toBe(true)
    expect(isDifficultySelectionPlayable(eligibility, ['easy', 'medium'])).toBe(true)

    setCachedEligibility('ds-1', {
      modes: { any: 2, easy: 2, medium: 0, hard: 0, nightmare: 0 }
    })
    const thin = getCachedEligibility('ds-1', 'character')!
    expect(isDifficultySelectionPlayable(thin, ['medium', 'hard'])).toBe(false)
    expect(isDifficultySelectionPlayable(thin, ['easy', 'medium'])).toBe(true)
  })
})
