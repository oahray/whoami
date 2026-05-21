import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../db/supabase.js'
import cardsRouter from './cards.js'
import { createQueryBuilder, type QueryState } from '../test-utils/supabaseQueryBuilder.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cardsRouter)
  return app
}

const DATASET_ENABLED = {
  id: 'ds-1',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

const ENTITY_A = {
  id: 'ent-a',
  name: 'Moses',
  type: 'character',
  is_published: true,
  dataset_id: 'ds-1'
}

const ENTITY_B = {
  id: 'ent-b',
  name: 'Aaron',
  type: 'character',
  is_published: true,
  dataset_id: 'ds-1'
}

const ENTITY_FEW = {
  id: 'ent-few',
  name: 'Sparse',
  type: 'character',
  is_published: true,
  dataset_id: 'ds-1'
}

function makeClues(entityId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `clue-${entityId}-${i}`,
    entity_id: entityId,
    text: `Clue ${i + 1} for ${entityId}`,
    citations: null,
    difficulty: i % 2 === 0 ? 'easy' : 'hard',
    created_at: `2026-01-0${i + 1}T00:00:00Z`
  }))
}

function cluesResolver(allClues: ReturnType<typeof makeClues>) {
  return (state: QueryState) => {
    if (state.table !== 'clues') {
      return { error: new Error('Unexpected') }
    }
    const entityEq = state.operations.find(
      (op) => op.method === 'eq' && op.args[0] === 'entity_id'
    )
    if (entityEq) {
      const entityId = entityEq.args[1] as string
      return { data: allClues.filter((c) => c.entity_id === entityId), error: null }
    }
    return { data: allClues, error: null }
  }
}

describe('GET /cards/random', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a shuffled card capped at 10 clues', async () => {
    const cluesA = makeClues('ent-a', 12)

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'datasets') {
          return { data: DATASET_ENABLED, error: null }
        }
        if (table === 'entities') {
          return { data: [ENTITY_A], error: null }
        }
        if (table === 'clues') {
          return cluesResolver(cluesA)(state)
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1',
      difficulty: 'any'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toMatch(/ent-/)
    expect(response.body.clues).toHaveLength(10)
    expect(response.body.clues[0].order).toBe(1)
    expect(response.body.clues[9].order).toBe(10)
    expect(response.body.entity.aliases).toEqual([])
  })

  it('excludes entities with fewer than 5 clues after difficulty filter', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'datasets') {
          return { data: DATASET_ENABLED, error: null }
        }
        if (table === 'entities') {
          return { data: [ENTITY_FEW, ENTITY_B], error: null }
        }
        if (table === 'clues') {
          return cluesResolver([...makeClues('ent-few', 4), ...makeClues('ent-b', 6)])(state)
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toBe('ent-b')
  })

  it('returns 404 when no eligible entities', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'datasets') {
          return { data: DATASET_ENABLED, error: null }
        }
        if (table === 'entities') {
          return { data: [ENTITY_FEW], error: null }
        }
        if (table === 'clues') {
          return cluesResolver(makeClues('ent-few', 4))(state)
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('NO_CARDS')
  })

  it('returns 400 for disabled dataset', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => {
        if (table === 'datasets') {
          return {
            data: { ...DATASET_ENABLED, is_enabled: false },
            error: null
          }
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('DATASET_DISABLED')
  })

  it('returns 400 when datasetId is missing', async () => {
    const response = await request(makeApp()).get('/cards/random')
    expect(response.status).toBe(400)
  })

  it('honours excludeEntityId when another entity is eligible', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'datasets') {
          return { data: DATASET_ENABLED, error: null }
        }
        if (table === 'entities') {
          return { data: [ENTITY_A, ENTITY_B], error: null }
        }
        if (table === 'clues') {
          return cluesResolver([...makeClues('ent-a', 6), ...makeClues('ent-b', 6)])(state)
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1',
      excludeEntityId: 'ent-a'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toBe('ent-b')
  })
})
