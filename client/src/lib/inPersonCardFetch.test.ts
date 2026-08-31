import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getInPersonCard,
  isLostCardError,
  CardFetchError,
  peekCachedCard,
  resetInPersonCardCacheForTests
} from './inPersonCardFetch'

const QUERY = { datasetId: 'ds-1', difficulty: 'any', entityType: 'character' }

describe('inPersonCardFetch', () => {
  beforeEach(() => {
    resetInPersonCardCacheForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('caches a successful card fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
        clues: [{ order: 1, text: 'Clue', citations: null }]
      })
    } as Response)

    const first = await getInPersonCard('ent-1', QUERY)
    const second = await getInPersonCard('ent-1', QUERY)

    expect(first.entity.name).toBe('Moses')
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(peekCachedCard('ds-1', 'ent-1')?.entity.id).toBe('ent-1')
  })

  it('treats 404 and 503 as lost cards', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'gone', code: 'ENTITY_NOT_FOUND' })
    } as Response)

    await expect(getInPersonCard('ent-9', QUERY)).rejects.toMatchObject({
      status: 404,
      code: 'ENTITY_NOT_FOUND'
    })
    expect(isLostCardError(new CardFetchError('gone', 404, 'ENTITY_NOT_FOUND'))).toBe(true)
    expect(isLostCardError(new CardFetchError('paused', 503, 'MAINTENANCE_ACTIVE'))).toBe(true)
    expect(isLostCardError(new CardFetchError('oops', 500))).toBe(false)
  })
})
