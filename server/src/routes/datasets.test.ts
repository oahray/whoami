import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

import { supabase } from '../db/supabase.js'
import publicDatasetsRouter from './datasets.js'
import { createQueryBuilder } from '../test-utils/supabaseQueryBuilder.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(publicDatasetsRouter)
  return app
}

const ROW_BIBLE = {
  id: 'ds-1',
  name: 'Bible',
  source: 'NWT',
  description: 'Hebrew + Greek Scriptures',
  is_official: true,
  is_enabled: true,
  is_default: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
}

const ROW_HISTORY = {
  id: 'ds-2',
  name: 'Org History',
  source: 'Wiki',
  description: 'Modern history',
  is_official: false,
  is_enabled: true,
  is_default: false
}

const ROW_DISABLED = {
  id: 'ds-3',
  name: 'Draft',
  source: null,
  description: null,
  is_official: false,
  is_enabled: false,
  is_default: false
}

describe('public datasets route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only enabled datasets with public-safe fields', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => {
        if (table === 'datasets') {
          return { data: [ROW_BIBLE, ROW_HISTORY, ROW_DISABLED], error: null }
        }
        return { error: new Error('Unexpected') }
      })
    )

    const response = await request(makeApp()).get('/datasets')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      {
        id: ROW_BIBLE.id,
        name: ROW_BIBLE.name,
        source: ROW_BIBLE.source,
        description: ROW_BIBLE.description,
        is_default: ROW_BIBLE.is_default
      },
      {
        id: ROW_HISTORY.id,
        name: ROW_HISTORY.name,
        source: ROW_HISTORY.source,
        description: ROW_HISTORY.description,
        is_default: ROW_HISTORY.is_default
      }
    ])
  })

  it('returns 500 if the underlying query fails', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, () => ({
        error: { message: 'boom' }
      }))
    )

    const response = await request(makeApp()).get('/datasets')

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Failed to fetch datasets')
  })
})
