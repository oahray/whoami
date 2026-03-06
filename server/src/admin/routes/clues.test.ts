import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../../db/supabase.js'
import cluesRouter from './clues.js'

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
    eq: (...args: any[]) => {
      state.operations.push({ method: 'eq', args })
      return builder
    },
    order: (...args: any[]) => {
      state.operations.push({ method: 'order', args })
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

describe('clues routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /entities/:id/clues rejects empty clue text', async () => {
    const app = express()
    app.use(express.json())
    app.use(cluesRouter)

    const response = await request(app).post('/entities/entity-1/clues').send({
      text: ''
    })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: 'Clue text is required'
    })
  })

  it('POST /entities/:id/clues uses route entity id and normalizes optional fields to null', async () => {
    let insertPayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        insertPayload = state.operations.find(op => op.method === 'insert')?.args[0]
        return {
          data: {
            id: 'clue-1',
            ...insertPayload
          },
          error: null
        }
      })
    )

    const app = express()
    app.use(express.json())
    app.use(cluesRouter)

    const response = await request(app).post('/entities/entity-123/clues').send({
      text: 'Led Israel out of Egypt',
      citations: '',
      difficulty: ''
    })

    expect(response.status).toBe(201)
    expect(insertPayload).toEqual({
      entity_id: 'entity-123',
      text: 'Led Israel out of Egypt',
      citations: null,
      difficulty: null
    })
    expect(response.body.entity_id).toBe('entity-123')
  })
})
