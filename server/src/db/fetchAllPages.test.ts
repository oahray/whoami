import { describe, expect, it, vi } from 'vitest'
import { SUPABASE_PAGE_SIZE, fetchAllPages } from './fetchAllPages.js'

describe('fetchAllPages', () => {
  it('returns a single short page', async () => {
    const rows = await fetchAllPages(async () => ({
      data: [{ id: 1 }, { id: 2 }],
      error: null
    }))
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('walks multiple full pages then a short page', async () => {
    const page0 = Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: i }))
    const page1 = Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({
      id: SUPABASE_PAGE_SIZE + i
    }))
    const page2 = [{ id: SUPABASE_PAGE_SIZE * 2 }]
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page0, error: null })
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })

    const rows = await fetchAllPages(fetchPage)

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, SUPABASE_PAGE_SIZE - 1)
    expect(fetchPage).toHaveBeenNthCalledWith(2, SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE * 2 - 1)
    expect(fetchPage).toHaveBeenNthCalledWith(3, SUPABASE_PAGE_SIZE * 2, SUPABASE_PAGE_SIZE * 3 - 1)
    expect(rows).toHaveLength(SUPABASE_PAGE_SIZE * 2 + 1)
    expect(rows[0]).toEqual({ id: 0 })
    expect(rows.at(-1)).toEqual({ id: SUPABASE_PAGE_SIZE * 2 })
  })

  it('throws when a page errors', async () => {
    await expect(
      fetchAllPages(async () => ({ data: null, error: { message: 'boom' } }))
    ).rejects.toThrow('boom')
  })
})
