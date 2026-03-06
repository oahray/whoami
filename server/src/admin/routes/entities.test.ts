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
    insert: (...args: any[]) => {
      state.operations.push({ method: 'insert', args })
      return builder
    },
    update: (...args: any[]) => {
      state.operations.push({ method: 'update', args })
      return builder
    },
    eq: (...args: any[]) => {
      state.operations.push({ method: 'eq', args })
      return builder
    },
    single: (...args: any[]) => {
      state.operations.push({ method: 'single', args })
      return builder
    },
    then: (resolve: any, reject: any) => Promise.resolve(resolver(state)).then(resolve, reject)
  }
  return builder
}

function hasEq(state: QueryState, column: string, value: unknown) {
  return state.operations.some(op => op.method === 'eq' && op.args[0] === column && op.args[1] === value)
}

describe('entities routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('POST /entities creates an unpublished entity by default', async () => {
    let insertedPayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        insertedPayload = state.operations.find(op => op.method === 'insert')?.args[0]
        return {
          data: {
            id: 'entity-1',
            name: insertedPayload.name,
            type: insertedPayload.type,
            is_published: insertedPayload.is_published
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
      is_published: false
    })
    expect(response.body.is_published).toBe(false)
  })

  it('PUT /entities/:id keeps entity unpublished when it has fewer than 3 clues', async () => {
    let updatePayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table === 'clues' && hasEq(state, 'entity_id', 'entity-1')) {
          return { count: 2, error: null }
        }

        if (table === 'entities') {
          updatePayload = state.operations.find(op => op.method === 'update')?.args[0]
          return {
            data: {
              id: 'entity-1',
              name: updatePayload.name,
              type: updatePayload.type,
              is_published: updatePayload.is_published
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
