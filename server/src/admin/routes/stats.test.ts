import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../../db/supabase.js'
import statsRouter from './stats.js'

type QueryState = {
  table: string
  operations: Array<{ method: string; args: any[] }>
}

function createQueryBuilder(
  table: string,
  resolver: (state: QueryState) => any
) {
  const state: QueryState = { table, operations: [] }
  const builder: any = {
    select: (...args: any[]) => {
      state.operations.push({ method: 'select', args })
      return builder
    },
    eq: (...args: any[]) => {
      state.operations.push({ method: 'eq', args })
      return builder
    },
    is: (...args: any[]) => {
      state.operations.push({ method: 'is', args })
      return builder
    },
    then: (resolve: any, reject: any) => Promise.resolve(resolver(state)).then(resolve, reject)
  }
  return builder
}

function hasEq(state: QueryState, column: string, value: unknown) {
  return state.operations.some(op => op.method === 'eq' && op.args[0] === column && op.args[1] === value)
}

function hasIs(state: QueryState, column: string, value: unknown) {
  return state.operations.some(op => op.method === 'is' && op.args[0] === column && op.args[1] === value)
}

describe('GET /stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns aggregated admin stats', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (state.table === 'entities' && hasEq(state, 'is_published', false)) {
          const selectArgs = state.operations.find(op => op.method === 'select')?.args
          if (selectArgs?.[0] === 'id') {
            return { data: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }], error: null }
          }
          return { count: 4, error: null }
        }

        if (state.table === 'entities' && hasEq(state, 'type', 'character')) {
          return { count: 7, error: null }
        }

        if (state.table === 'entities' && hasEq(state, 'type', 'place')) {
          return { count: 2, error: null }
        }

        if (state.table === 'entities') {
          return { count: 9, error: null }
        }

        if (state.table === 'clues' && hasEq(state, 'difficulty', 'easy')) {
          return { count: 3, error: null }
        }

        if (state.table === 'clues' && hasEq(state, 'difficulty', 'medium')) {
          return { count: 2, error: null }
        }

        if (state.table === 'clues' && hasEq(state, 'difficulty', 'hard')) {
          return { count: 1, error: null }
        }

        if (state.table === 'clues' && hasEq(state, 'difficulty', 'nightmare')) {
          return { count: 0, error: null }
        }

        if (state.table === 'clues' && hasIs(state, 'difficulty', null)) {
          return { count: 5, error: null }
        }

        const selectArgs = state.operations.find(op => op.method === 'select')?.args
        if (state.table === 'clues' && selectArgs?.[0] === 'entity_id') {
          return {
            data: [
              { entity_id: 'e1' },
              { entity_id: 'e1' },
              { entity_id: 'e1' },
              { entity_id: 'e2' },
              { entity_id: 'e2' },
              { entity_id: 'e3' },
              { entity_id: 'e3' },
              { entity_id: 'e3' }
            ],
            error: null
          }
        }

        if (state.table === 'clues') {
          return { count: 27, error: null }
        }

        return { error: new Error(`Unexpected query for table ${state.table}`) }
      })
    )

    const app = express()
    app.use(statsRouter)

    const response = await request(app).get('/stats')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      totalClues: 27,
      totalEntities: 9,
      avgCluesPerEntity: 3,
      unpublishedCount: 4,
      publishedCount: 5,
      difficultyCounts: {
        easy: 3,
        medium: 2,
        hard: 1,
        nightmare: 0
      },
      cluesWithoutDifficulty: 5,
      entityCountByType: {
        character: 7,
        place: 2
      },
      readyToPublishCount: 2
    })
  })
})
