import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../../db/supabase.js'
import datasetsRouter from './datasets.js'
import { createQueryBuilder, findOp, hasEq, hasOp } from '../../test-utils/supabaseQueryBuilder.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(datasetsRouter)
  return app
}

const DATASET_ROW = {
  id: 'ds-1',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

describe('datasets routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /datasets returns the list ordered by name', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => {
        if (table === 'datasets') {
          return { data: [DATASET_ROW], error: null }
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/datasets')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([DATASET_ROW])
  })

  it('POST /datasets rejects empty name', async () => {
    const response = await request(makeApp()).post('/datasets').send({ name: '   ' })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Dataset name is required')
  })

  it('POST /datasets creates a new dataset with defaults', async () => {
    let insertedPayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        insertedPayload = findOp(state, 'insert')?.args[0]
        return {
          data: { id: 'ds-new', ...(insertedPayload as Record<string, unknown>) },
          error: null
        }
      })
    )

    const response = await request(makeApp()).post('/datasets').send({
      name: 'Apocrypha',
      source: 'Stub'
    })

    expect(response.status).toBe(201)
    expect(insertedPayload).toEqual({
      name: 'Apocrypha',
      source: 'Stub',
      description: null,
      is_official: false,
      is_enabled: true,
      is_default: false
    })
    expect(response.body.id).toBe('ds-new')
  })

  it('PATCH /datasets/:id rejects disabling the last enabled dataset', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table !== 'datasets') {
          return { error: new Error(`Unexpected table ${table}`) }
        }

        if (hasEq(state, 'id', 'ds-1') && hasOp(state, 'maybeSingle')) {
          return { data: DATASET_ROW, error: null }
        }

        if (hasOp(state, 'select', args => (args[1] as any)?.head === true)) {
          return { count: 1, error: null }
        }

        return { error: new Error('Unexpected dataset query') }
      })
    )

    const response = await request(makeApp())
      .patch('/datasets/ds-1')
      .send({ is_enabled: false })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('CANNOT_DISABLE_LAST_ENABLED')
  })

  it('PATCH /datasets/:id clears other defaults when setting is_default true', async () => {
    let neqClearArgs: unknown[] | null = null
    let updatedPayload: any = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state) => {
        if (table !== 'datasets') {
          return { error: new Error(`Unexpected table ${table}`) }
        }

        if (hasEq(state, 'id', 'ds-2') && hasOp(state, 'maybeSingle')) {
          return {
            data: { ...DATASET_ROW, id: 'ds-2', is_default: false },
            error: null
          }
        }

        const updateOp = findOp(state, 'update')
        const neqOp = findOp(state, 'neq')

        if (updateOp && (updateOp.args[0] as any)?.is_default === false && neqOp) {
          neqClearArgs = neqOp.args
          return { error: null }
        }

        if (updateOp) {
          updatedPayload = updateOp.args[0]
          return {
            data: { ...DATASET_ROW, id: 'ds-2', ...(updatedPayload as Record<string, unknown>) },
            error: null
          }
        }

        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp())
      .patch('/datasets/ds-2')
      .send({ is_default: true })

    expect(response.status).toBe(200)
    expect(neqClearArgs).toEqual(['id', 'ds-2'])
    expect(updatedPayload).toEqual({ is_default: true })
    expect(response.body.is_default).toBe(true)
  })
})
