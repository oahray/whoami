import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../../db/supabase.js'
import entitiesRouter from './entities.js'
import { createQueryBuilder, findOp, hasEq } from '../../test-utils/supabaseQueryBuilder.js'

const DEFAULT_DATASET = {
  id: 'ds-default',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

describe('entities routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /entities loads clue counts in one query (no N+1)', async () => {
    const fromCalls: string[] = []

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      fromCalls.push(table)
      return createQueryBuilder(table, (state) => {
        if (state.table === 'datasets') {
          return { data: DEFAULT_DATASET, error: null }
        }

        if (state.table === 'entities') {
          const selectArgs = findOp(state, 'select')?.args
          expect(selectArgs?.[0]).toBe('*, clues(count)')
          return {
            data: [
              {
                id: 'e1',
                name: 'Moses',
                type: 'character',
                is_published: true,
                clues: [{ count: 4 }]
              },
              {
                id: 'e2',
                name: 'Egypt',
                type: 'place',
                is_published: false,
                clues: [{ count: 0 }]
              }
            ],
            error: null
          }
        }

        return { error: new Error(`Unexpected query for table ${table}`) }
      })
    })

    const app = express()
    app.use(entitiesRouter)

    const response = await request(app).get('/entities')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      {
        id: 'e1',
        name: 'Moses',
        type: 'character',
        is_published: true,
        clueCount: 4
      },
      {
        id: 'e2',
        name: 'Egypt',
        type: 'place',
        is_published: false,
        clueCount: 0
      }
    ])
    expect(fromCalls.filter((table) => table === 'clues')).toHaveLength(0)
    expect(fromCalls.filter((table) => table === 'entities')).toHaveLength(1)
  })

  it('POST /entities rejects missing required fields', async () => {
    const app = express()
    app.use(express.json())
    app.use(entitiesRouter)

    const response = await request(app).post('/entities').send({ name: '' })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: 'Missing required fields: name, type'
    })
  })

  it('POST /entities stamps the default dataset and creates an unpublished entity', async () => {
    let insertedPayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (state.table === 'datasets') {
          return { data: DEFAULT_DATASET, error: null }
        }

        insertedPayload = findOp(state, 'insert')?.args[0]
        return {
          data: {
            id: 'entity-1',
            ...(insertedPayload as Record<string, unknown>)
          },
          error: null
        }
      })
    )

    const app = express()
    app.use(express.json())
    app.use(entitiesRouter)

    const response = await request(app).post('/entities').send({
      name: 'Moses',
      type: 'character'
    })

    expect(response.status).toBe(201)
    expect(insertedPayload).toEqual({
      name: 'Moses',
      type: 'character',
      is_published: false,
      dataset_id: 'ds-default',
      aliases: []
    })
    expect(response.body.is_published).toBe(false)
    expect(response.body.dataset_id).toBe('ds-default')
  })

  it('PUT /entities/:id keeps entity unpublished when it has fewer than 3 clues', async () => {
    let updatePayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'clues' && hasEq(state, 'entity_id', 'entity-1')) {
          return { count: 2, error: null }
        }

        if (table === 'entities') {
          updatePayload = findOp(state, 'update')?.args[0]
          return {
            data: {
              id: 'entity-1',
              name: (updatePayload as any).name,
              type: (updatePayload as any).type,
              is_published: (updatePayload as any).is_published
            },
            error: null
          }
        }

        return { error: new Error(`Unexpected query for table ${table}`) }
      })
    )

    const app = express()
    app.use(express.json())
    app.use(entitiesRouter)

    const response = await request(app).put('/entities/entity-1').send({
      name: 'Moses',
      type: 'character',
      is_published: true
    })

    expect(response.status).toBe(200)
    expect(updatePayload).toEqual({
      name: 'Moses',
      type: 'character',
      is_published: false
    })
    expect(response.body.is_published).toBe(false)
  })
})
