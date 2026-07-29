import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceToNextDeck,
  currentDeckEntityIds,
  currentEntityId,
  deckProgressLabel,
  fetchInPersonDeck,
  hasNextDeck,
  IN_PERSON_DECK_SIZE,
  isDeckExhausted,
  isSessionComplete,
  loadDeckSession,
  remainingEntityCount,
  saveDeckSession,
  snapshotForIndex,
  updateCardSnapshot
} from './inPersonDeck'
import type { InPersonCard } from '../types'

const POOL = Array.from({ length: 25 }, (_, i) => `ent-${i + 1}`)

function makeSession(overrides: Partial<Parameters<typeof saveDeckSession>[0]> = {}) {
  return {
    datasetId: 'ds-1',
    difficulty: [] as const,
    entityType: 'character' as const,
    masterPool: POOL,
    deckStartOffset: 0,
    index: 0,
    history: [],
    ...overrides
  }
}

const SAMPLE_CARD: InPersonCard = {
  entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
  clues: [{ order: 1, text: 'Clue', citations: null }]
}

describe('inPersonDeck', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('slices the current deck to 10 entities', () => {
    const session = makeSession()
    expect(currentDeckEntityIds(session)).toEqual(POOL.slice(0, 10))
    expect(currentEntityId(session)).toBe('ent-1')
  })

  it('reports deck and session completion', () => {
    const midDeck = makeSession({ index: 9 })
    expect(isDeckExhausted(midDeck)).toBe(false)

    const deckDone = makeSession({ index: 10 })
    expect(isDeckExhausted(deckDone)).toBe(true)
    expect(hasNextDeck(deckDone)).toBe(true)
    expect(isSessionComplete(deckDone)).toBe(false)
    expect(remainingEntityCount(deckDone)).toBe(15)

    const lastDeckStart = 20
    const sessionDone = makeSession({ deckStartOffset: lastDeckStart, index: 5 })
    expect(isDeckExhausted(sessionDone)).toBe(true)
    expect(hasNextDeck(sessionDone)).toBe(false)
    expect(isSessionComplete(sessionDone)).toBe(true)
    expect(remainingEntityCount(sessionDone)).toBe(0)
  })

  it('advances to the next deck slice', () => {
    const done = makeSession({ index: IN_PERSON_DECK_SIZE })
    const next = advanceToNextDeck(done)
    expect(next.deckStartOffset).toBe(IN_PERSON_DECK_SIZE)
    expect(next.index).toBe(0)
    expect(next.history).toEqual([])
    expect(currentDeckEntityIds(next)).toEqual(POOL.slice(10, 20))
  })

  it('formats progress with deck number', () => {
    const session = makeSession({ deckStartOffset: 10, index: 2 })
    expect(deckProgressLabel(session)).toBe('Card 3 of 10 · Deck 2 of 3')
  })

  it('stores and restores card snapshots by index', () => {
    const session = makeSession()
    const withSnapshot = updateCardSnapshot(session, {
      card: SAMPLE_CARD,
      revealedCount: 2,
      showAnswer: true
    })
    saveDeckSession(withSnapshot)
    const loaded = loadDeckSession('ds-1', 'any', 'character')
    expect(snapshotForIndex(loaded!, 0)).toEqual({
      card: SAMPLE_CARD,
      revealedCount: 2,
      showAnswer: true
    })
  })

  it('rejects legacy sessions without masterPool', () => {
    sessionStorage.setItem(
      'whoami-in-person-deck',
      JSON.stringify({
        datasetId: 'ds-1',
        difficulty: [],
        entityType: 'character',
        entityIds: ['ent-1'],
        index: 0
      })
    )
    expect(loadDeckSession('ds-1', 'any', 'character')).toBeNull()
  })

  it('fetchInPersonDeck builds a new session from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ entityIds: ['a', 'b', 'c'] })
      })
    )

    const session = await fetchInPersonDeck('ds-1', 'any', 'character')
    expect(session.masterPool).toEqual(['a', 'b', 'c'])
    expect(session.deckStartOffset).toBe(0)
    expect(loadDeckSession('ds-1', 'any', 'character')).toEqual(session)

    vi.unstubAllGlobals()
  })
})
