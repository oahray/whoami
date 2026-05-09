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
import { createQueryBuilder, findOp } from '../../test-utils/supabaseQueryBuilder.js'

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
        insertPayload = findOp(state, 'insert')?.args[0]
        return {
          data: {
            id: 'clue-1',
            ...(insertPayload as Record<string, unknown>)
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
