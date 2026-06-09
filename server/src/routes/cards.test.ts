import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

vi.mock('../db/maintenance.js', () => ({
  getMaintenanceBlock: vi.fn().mockResolvedValue(null)
}))

import { supabase } from '../db/supabase.js'
import cardsRouter from './cards.js'
import {
  createQueryBuilder,
  hasEq,
  hasOp,
  type QueryResolver,
  type QueryState
} from '../test-utils/supabaseQueryBuilder.js'

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

const ENTITY_PLACE = {
  id: 'ent-place',
  name: 'Jerusalem',
  type: 'place',
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
      let rows = allClues.filter((c) => c.entity_id === entityId)
      const difficultyEq = state.operations.find(
        (op) => op.method === 'eq' && op.args[0] === 'difficulty'
      )
      if (difficultyEq) {
        rows = rows.filter((c) => c.difficulty === difficultyEq.args[1])
      }
      return { data: rows, error: null }
    }
    return { data: allClues, error: null }
  }
}

function installMocks(
  entities: (typeof ENTITY_A)[],
  allClues: ReturnType<typeof makeClues>
) {
  vi.mocked(supabase.from).mockImplementation((table: string) =>
    createQueryBuilder(table, inPersonMockResolver(entities, allClues))
  )
}

function inPersonMockResolver(
  entities: (typeof ENTITY_A)[],
  allClues: ReturnType<typeof makeClues>
): QueryResolver {
  return (state: QueryState) => {
    const table = state.table
    if (table === 'datasets') {
      return { data: DATASET_ENABLED, error: null }
    }
    if (table === 'entities') {
      if (hasOp(state, 'maybeSingle')) {
        const id = state.operations.find((op) => op.method === 'eq' && op.args[0] === 'id')
          ?.args[1] as string | undefined
        const entity = entities.find((e) => e.id === id) ?? null
        return { data: entity, error: null }
      }
      if (hasEq(state, 'dataset_id', 'ds-1')) {
        return { data: entities, error: null }
      }
      return { data: entities, error: null }
    }
    if (table === 'clues') {
      return cluesResolver(allClues)(state)
    }
    return { error: new Error('Unexpected') }
  }
}

describe('GET /cards/random', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a shuffled card capped at 10 clues', async () => {
    const cluesA = makeClues('ent-a', 12)

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, inPersonMockResolver([ENTITY_A], cluesA))
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

  it('excludes entities with fewer than 3 clues after difficulty filter', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(
        table,
        inPersonMockResolver(
          [ENTITY_FEW, ENTITY_B],
          [...makeClues('ent-few', 2), ...makeClues('ent-b', 6)]
        )
      )
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toBe('ent-b')
  })

  it('returns 404 when no eligible entities', async () => {
    installMocks([ENTITY_FEW], makeClues('ent-few', 2))

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
    installMocks(
      [ENTITY_A, ENTITY_B],
      [...makeClues('ent-a', 6), ...makeClues('ent-b', 6)]
    )

    const response = await request(makeApp()).get('/cards/random').query({
      datasetId: 'ds-1',
      excludeEntityId: 'ent-a'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toBe('ent-b')
  })
})

describe('GET /cards/eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns eligible entity counts per difficulty mode', async () => {
    installMocks(
      [ENTITY_A, ENTITY_B],
      [...makeClues('ent-a', 6), ...makeClues('ent-b', 6)]
    )

    const response = await request(makeApp()).get('/cards/eligibility').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.modes.any).toBe(2)
    expect(response.body.modes.easy).toBe(2)
    expect(response.body.modes.hard).toBe(2)
    expect(response.body.modes.medium).toBe(0)
    expect(response.body.modes.nightmare).toBe(0)
  })

  it('defaults to characters and excludes places', async () => {
    installMocks(
      [ENTITY_A, ENTITY_PLACE],
      [...makeClues('ent-a', 6), ...makeClues('ent-place', 6)]
    )

    const response = await request(makeApp()).get('/cards/eligibility').query({
      datasetId: 'ds-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.modes.any).toBe(1)
  })

  it('counts only places when entityType is place', async () => {
    installMocks(
      [ENTITY_A, ENTITY_PLACE],
      [...makeClues('ent-a', 6), ...makeClues('ent-place', 6)]
    )

    const response = await request(makeApp()).get('/cards/eligibility').query({
      datasetId: 'ds-1',
      entityType: 'place'
    })

    expect(response.status).toBe(200)
    expect(response.body.modes.any).toBe(1)
  })
})

describe('GET /cards/deck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a shuffled list of eligible entity ids', async () => {
    installMocks(
      [ENTITY_A, ENTITY_B],
      [...makeClues('ent-a', 6), ...makeClues('ent-b', 6)]
    )

    const response = await request(makeApp()).get('/cards/deck').query({
      datasetId: 'ds-1',
      difficulty: 'any'
    })

    expect(response.status).toBe(200)
    expect(response.body.entityIds).toHaveLength(2)
    expect(response.body.entityIds).toEqual(expect.arrayContaining(['ent-a', 'ent-b']))
  })

  it('filters deck to places when entityType is place', async () => {
    installMocks(
      [ENTITY_A, ENTITY_PLACE],
      [...makeClues('ent-a', 6), ...makeClues('ent-place', 6)]
    )

    const response = await request(makeApp()).get('/cards/deck').query({
      datasetId: 'ds-1',
      difficulty: 'any',
      entityType: 'place'
    })

    expect(response.status).toBe(200)
    expect(response.body.entityIds).toEqual(['ent-place'])
  })
})

describe('GET /cards/entity/:entityId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a card for a specific entity', async () => {
    installMocks([ENTITY_A], makeClues('ent-a', 6))

    const response = await request(makeApp()).get('/cards/entity/ent-a').query({
      datasetId: 'ds-1',
      difficulty: 'any'
    })

    expect(response.status).toBe(200)
    expect(response.body.entity.id).toBe('ent-a')
    expect(response.body.clues.length).toBeGreaterThanOrEqual(3)
  })
})
