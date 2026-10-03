import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}))

vi.mock('./maintenance.js', () => ({
  canPurgeDataset: vi.fn()
}))

vi.mock('./entities.js', () => ({
  getDataset: vi.fn()
}))

import { supabase } from './supabase.js'
import { canPurgeDataset } from './maintenance.js'
import { getDataset } from './entities.js'
import {
  parsePurgeMode,
  purgeDatasetContent,
  DatasetContentError
} from './datasetContent.js'
import {
  createQueryBuilder,
  findOp,
  hasEq,
  hasOp,
  type QueryState
} from '../test-utils/supabaseQueryBuilder.js'

const DATASET = {
  id: 'ds-1',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

describe('parsePurgeMode', () => {
  it('defaults to clues', () => {
    expect(parsePurgeMode(undefined)).toBe('clues')
    expect(parsePurgeMode(null)).toBe('clues')
    expect(parsePurgeMode('')).toBe('clues')
  })

  it('accepts clues and all', () => {
    expect(parsePurgeMode('clues')).toBe('clues')
    expect(parsePurgeMode('all')).toBe('all')
  })

  it('rejects invalid modes', () => {
    expect(() => parsePurgeMode('entities')).toThrow(DatasetContentError)
  })
})

describe('purgeDatasetContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDataset).mockResolvedValue(DATASET as never)
    vi.mocked(canPurgeDataset).mockResolvedValue(true)
  })

  it('rejects when selected dataset does not match', async () => {
    await expect(
      purgeDatasetContent('ds-1', { selectedDatasetId: 'ds-other', mode: 'clues' })
    ).rejects.toMatchObject({ code: 'DATASET_MISMATCH' })
  })

  it('rejects outside an active maintenance window', async () => {
    vi.mocked(canPurgeDataset).mockResolvedValue(false)
    await expect(
      purgeDatasetContent('ds-1', { selectedDatasetId: 'ds-1', mode: 'clues' })
    ).rejects.toMatchObject({ code: 'MAINTENANCE_REQUIRED' })
  })

  it('deletes clues only, keeps entities, and unpublishes', async () => {
    const deletedEntityFilters: string[] = []
    let unpublished = false

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state: QueryState) => {
        if (table === 'entities' && hasOp(state, 'select') && !findOp(state, 'update') && !findOp(state, 'delete')) {
          return { data: [{ id: 'ent-a' }, { id: 'ent-b' }], error: null }
        }
        if (table === 'clues' && hasOp(state, 'select', (args) => Boolean((args[1] as { head?: boolean })?.head))) {
          return { count: 5, error: null }
        }
        if (table === 'clues' && findOp(state, 'delete')) {
          const inOp = findOp(state, 'in')
          deletedEntityFilters.push(...((inOp?.args[1] as string[]) ?? []))
          return { error: null }
        }
        if (table === 'entities' && findOp(state, 'update')) {
          unpublished = true
          expect(hasEq(state, 'is_published', true)).toBe(true)
          expect(findOp(state, 'update')?.args[0]).toEqual({ is_published: false })
          return { data: [{ id: 'ent-a' }], error: null }
        }
        return { error: new Error(`Unexpected ${table}`) }
      })
    )

    const result = await purgeDatasetContent('ds-1', {
      selectedDatasetId: 'ds-1',
      mode: 'clues'
    })

    expect(result).toEqual({
      mode: 'clues',
      cluesDeleted: 5,
      entitiesUnpublished: 1
    })
    expect(deletedEntityFilters.sort()).toEqual(['ent-a', 'ent-b'])
    expect(unpublished).toBe(true)
  })

  it('defaults to clues mode when mode is omitted', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state: QueryState) => {
        if (table === 'entities' && hasOp(state, 'select') && !findOp(state, 'update')) {
          return { data: [], error: null }
        }
        return { error: new Error(`Unexpected ${table}`) }
      })
    )

    const result = await purgeDatasetContent('ds-1', { selectedDatasetId: 'ds-1' })
    expect(result).toEqual({ mode: 'clues', cluesDeleted: 0, entitiesUnpublished: 0 })
  })

  it('deletes entities for full purge', async () => {
    let deletedDatasetId: string | null = null

    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(table, (state: QueryState) => {
        if (table === 'entities' && hasOp(state, 'select', (args) => Boolean((args[1] as { head?: boolean })?.head))) {
          return { count: 12, error: null }
        }
        if (table === 'entities' && findOp(state, 'delete')) {
          deletedDatasetId = hasEq(state, 'dataset_id', 'ds-1') ? 'ds-1' : null
          return { error: null }
        }
        return { error: new Error(`Unexpected ${table}`) }
      })
    )

    const result = await purgeDatasetContent('ds-1', {
      selectedDatasetId: 'ds-1',
      mode: 'all'
    })

    expect(result).toEqual({ mode: 'all', entitiesDeleted: 12 })
    expect(deletedDatasetId).toBe('ds-1')
  })
})
