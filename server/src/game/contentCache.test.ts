import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../db/supabase.js'
import { createQueryBuilder, hasOp } from '../test-utils/supabaseQueryBuilder.js'
import { cachedContent, clearContentCache } from './contentCache.js'
import {
  buildInPersonCardForEntity,
  getInPersonDeck,
  getInPersonEligibility,
  InPersonPlayError,
  resolvePublishedEntities
} from './inPersonPlay.js'

const DATASET = { id: 'ds-1', name: 'Bible', is_enabled: true, is_default: true }
const ENTITIES = ['moses', 'aaron', 'ruth'].map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  type: 'character',
  is_published: true,
  dataset_id: 'ds-1',
  aliases: []
}))
const CLUES = ENTITIES.flatMap((entity) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `${entity.id}-${i}`,
    entity_id: entity.id,
    text: `${entity.name} clue ${i}`,
    citations: null,
    difficulty: i % 2 === 0 ? 'easy' : 'hard',
    created_at: `2026-01-0${i + 1}T00:00:00Z`
  }))
)

let tables: string[] = []

beforeEach(() => {
  clearContentCache()
  tables = []
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    tables.push(table)
    return createQueryBuilder(table, (state) => {
      if (table === 'datasets') return { data: hasOp(state, 'maybeSingle') ? DATASET : [DATASET], error: null }
      if (table === 'entities') return { data: ENTITIES, error: null }
      if (table === 'clues') {
        const entityEq = state.operations.find((op) => op.method === 'eq' && op.args[0] === 'entity_id')
        const rows = entityEq ? CLUES.filter((clue) => clue.entity_id === entityEq.args[1]) : CLUES
        return { data: rows, error: null }
      }
      return { error: new Error(`Unexpected table ${table}`) }
    }) as never
  })
})

describe('public content cache', () => {
  it('serves repeat decks from memory but still shuffles each one', async () => {
    const decks = []
    for (let i = 0; i < 20; i += 1) decks.push((await getInPersonDeck('ds-1', [])).entityIds.join(','))
    // datasets, entities and clue counts once each, then nothing.
    expect(tables).toEqual(['datasets', 'entities', 'clues'])
    expect(new Set(decks).size).toBeGreaterThan(1)
  })

  it('loads a character once and filters difficulty in memory', async () => {
    const all = await buildInPersonCardForEntity({ datasetId: 'ds-1', entityId: 'moses' })
    const easy = await buildInPersonCardForEntity({
      datasetId: 'ds-1',
      entityId: 'moses',
      difficultySelection: ['easy']
    })
    expect(all.clues).toHaveLength(8)
    expect(easy.clues.map((clue) => clue.text).sort()).toEqual(
      ['Moses clue 0', 'Moses clue 2', 'Moses clue 4', 'Moses clue 6'].sort()
    )
    expect(tables.filter((table) => table === 'clues')).toHaveLength(1)
  })

  it('answers made-up ids without touching the database again', async () => {
    await getInPersonEligibility('ds-1', 'all', [])
    const before = tables.length
    await expect(
      buildInPersonCardForEntity({ datasetId: 'ds-1', entityId: 'not-a-real-id' })
    ).rejects.toBeInstanceOf(InPersonPlayError)
    await expect(getInPersonDeck('no-such-dataset', [])).rejects.toBeInstanceOf(InPersonPlayError)
    expect(tables.length).toBe(before)
  })

  it('resolves Review cards by id and by name from the cached list', async () => {
    const resolved = await resolvePublishedEntities('ds-1', [
      { id: 'ruth' },
      { id: 'old-moses-id', name: 'Moses' },
      { id: 'gone', name: 'Nobody' }
    ])
    expect(resolved).toEqual([
      { id: 'ruth', name: 'Ruth', previousId: 'ruth' },
      { id: 'moses', name: 'Moses', previousId: 'old-moses-id' }
    ])
  })

  it('goes back to the database after the cache is cleared', async () => {
    await getInPersonDeck('ds-1', [])
    clearContentCache()
    await getInPersonDeck('ds-1', [])
    expect(tables.filter((table) => table === 'entities')).toHaveLength(2)
  })
})

describe('cachedContent', () => {
  it('shares one load between callers and does not keep failures', async () => {
    let loads = 0
    const load = async () => {
      loads += 1
      if (loads === 1) throw new Error('database hiccup')
      return 'ok'
    }
    await expect(cachedContent('k', load)).rejects.toThrow('database hiccup')
    const [a, b] = await Promise.all([cachedContent('k', load), cachedContent('k', load)])
    expect([a, b, loads]).toEqual(['ok', 'ok', 2])
  })

  it('expires after five minutes', async () => {
    let loads = 0
    const load = async () => ++loads
    await cachedContent('t', load, 0)
    await cachedContent('t', load, 4 * 60_000)
    await cachedContent('t', load, 5 * 60_000 + 1)
    expect(loads).toBe(2)
  })
})
