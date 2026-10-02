import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getInPersonCard,
  isLostCardError,
  CardFetchError,
  peekCachedCard,
  peekCachedDailyCard,
  resetInPersonCardCacheForTests
} from './inPersonCardFetch'

const CLASSIC = { datasetId: 'ds-1', difficulty: 'any', entityType: 'character' }
const DAILY = {
  datasetId: 'ds-1',
  difficulty: 'any',
  entityType: 'all',
  dailyChallengeId: '2026-10-02-v3'
}

function cardBody(name: string, clue: string) {
  return {
    entity: { id: 'ent-1', name, type: 'character', aliases: [] },
    clues: [{ order: 1, text: clue, citations: null }]
  }
}

describe('inPersonCardFetch', () => {
  beforeEach(() => {
    resetInPersonCardCacheForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('caches a successful classic card fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cardBody('Moses', 'Classic clue')
    } as Response)

    const first = await getInPersonCard('ent-1', CLASSIC)
    const second = await getInPersonCard('ent-1', CLASSIC)

    expect(first.entity.name).toBe('Moses')
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(peekCachedCard('ds-1', 'ent-1')?.clues[0]?.text).toBe('Classic clue')
  })

  it('keeps Daily and Classic caches isolated for the same entity', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      const isDaily = url.includes('dailyChallengeId=')
      return {
        ok: true,
        status: 200,
        json: async () =>
          cardBody(isDaily ? 'Daily Moses' : 'Classic Moses', isDaily ? 'Daily clue' : 'Classic clue')
      } as Response
    })

    const daily = await getInPersonCard('ent-1', DAILY)
    const classic = await getInPersonCard('ent-1', CLASSIC)

    expect(daily.clues[0]?.text).toBe('Daily clue')
    expect(classic.clues[0]?.text).toBe('Classic clue')
    expect(peekCachedDailyCard('2026-10-02-v3', 'ent-1')?.clues[0]?.text).toBe('Daily clue')
    expect(peekCachedCard('ds-1', 'ent-1')?.clues[0]?.text).toBe('Classic clue')
    expect(peekCachedDailyCard('2026-10-02-v3', 'ent-1')).not.toBe(peekCachedCard('ds-1', 'ent-1'))

    await getInPersonCard('ent-1', DAILY)
    await getInPersonCard('ent-1', CLASSIC)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('sends dailyChallengeId only for Daily fetches', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cardBody('Moses', 'Clue')
    } as Response)

    await getInPersonCard('ent-1', DAILY)
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      'dailyChallengeId=2026-10-02-v3'
    )

    await getInPersonCard('ent-1', CLASSIC)
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).not.toContain('dailyChallengeId=')
  })

  it('treats 404 and 503 as lost cards', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'gone', code: 'ENTITY_NOT_FOUND' })
    } as Response)

    await expect(getInPersonCard('ent-9', CLASSIC)).rejects.toMatchObject({
      status: 404,
      code: 'ENTITY_NOT_FOUND'
    })
    expect(isLostCardError(new CardFetchError('gone', 404, 'ENTITY_NOT_FOUND'))).toBe(true)
    expect(isLostCardError(new CardFetchError('paused', 503, 'MAINTENANCE_ACTIVE'))).toBe(true)
    expect(isLostCardError(new CardFetchError('oops', 500))).toBe(false)
  })
})
