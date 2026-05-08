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
import { createQueryBuilder, findOp, hasEq, hasIs } from '../../test-utils/supabaseQueryBuilder.js'

const DATASET_ID = 'ds-default'

describe('GET /stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns stats scoped to the resolved dataset', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (state.table === 'datasets') {
          return {
            data: {
              id: DATASET_ID,
              name: 'Bible',
              source: null,
              description: null,
              is_official: true,
              is_enabled: true,
              is_default: true
            },
            error: null
          }
        }

        if (state.table === 'entities' && hasEq(state, 'is_published', false)) {
          return { count: 4, error: null }
        }

        if (state.table === 'entities' && hasEq(state, 'type', 'character')) {
          return { count: 7, error: null }
        }

        if (state.table === 'entities' && hasEq(state, 'type', 'place')) {
          return { count: 2, error: null }
        }

        if (state.table === 'entities') {
          const selectArgs = findOp(state, 'select')?.args
          if (selectArgs?.[0] === 'id, is_published') {
            return {
              data: [
                { id: 'e1', is_published: false },
                { id: 'e2', is_published: true },
                { id: 'e3', is_published: false }
              ],
              error: null
            }
          }
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

        const selectArgs = findOp(state, 'select')?.args
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
      datasetId: DATASET_ID,
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

  it('returns NO_DATASET when no dataset can be resolved', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => {
        if (table === 'datasets') {
          return { data: null, error: null }
        }
        return { error: new Error('Unexpected') }
      })
    )

    const app = express()
    app.use(statsRouter)

    const response = await request(app).get('/stats')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('NO_DATASET')
  })
})
