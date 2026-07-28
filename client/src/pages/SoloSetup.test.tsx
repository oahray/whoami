import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import { loadSoloSession } from '../lib/soloSession'
import SoloSetup from './SoloSetup'

vi.mock('../hooks/useMaintenanceStatus', () => ({
  useMaintenanceStatus: () => ({
    status: { phase: 'none', endsAt: null, startsAt: null },
    loading: false
  })
}))

describe('SoloSetup', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => [{ id: 'ds-1', name: 'Bible', is_default: true, source: null, description: null }] } as Response
      }
      if (url.includes('/cards/eligibility')) {
        return { ok: true, json: async () => ({ modes: { any: 12, easy: 12, medium: 0, hard: 0, nightmare: 0 } }) } as Response
      }
      if (url.includes('/cards/deck')) {
        return { ok: true, json: async () => ({ entityIds: Array.from({ length: 12 }, (_, index) => `ent-${index}`) }) } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  it('starts a ten-round challenge session with the selected timing', async () => {
    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('button', { name: /start 10-round challenge/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/new clue every/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /start 10-round challenge/i }))

    await waitFor(() => expect(loadSoloSession()).not.toBeNull())
    expect(loadSoloSession()).toMatchObject({
      variation: 'challenge',
      clueRevealIntervalMs: 5000
    })
    expect(loadSoloSession()?.entityIds).toHaveLength(10)
  })
})
