import { describe, expect, it, vi } from 'vitest'
import { fetchOkJson } from './fetchOkJson'

describe('fetchOkJson', () => {
  it('returns JSON on the first success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'ds-1' }]
      })
    )

    await expect(fetchOkJson('/datasets', (status) => `Failed (${status})`)).resolves.toEqual([
      { id: 'ds-1' }
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('retries a 500 and then succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'ds-1' }]
        })
    )

    await expect(
      fetchOkJson('/datasets', (status) => `Failed to load content (${status})`)
    ).resolves.toEqual([{ id: 'ds-1' }])
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('does not retry a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({})
      })
    )

    await expect(
      fetchOkJson('/datasets', (status) => `Failed to load content (${status})`)
    ).rejects.toThrow('Failed to load content (404)')
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
