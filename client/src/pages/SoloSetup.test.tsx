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
    localStorage.clear()
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

  it('shows personal bests without revealing content pool size', async () => {
    const { saveSoloRecord } = await import('../lib/soloSession')
    saveSoloRecord({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      correctCount: 7,
      activeElapsedMs: 90_000,
      achievedAt: '2026-01-01T00:00:00.000Z'
    })
    saveSoloRecord({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      correctCount: 12,
      activeElapsedMs: 120_000,
      achievedAt: '2026-01-02T00:00:00.000Z'
    })

    renderWithPreferences(
      <MemoryRouter>
        <SoloSetup />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: /personal bests/i })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /^solo challenge$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^endurance$/i })).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText(/^Bible$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/12 character/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument()
  })

  it('restores the last selected setup options', async () => {
    const { saveSoloSetupPreferences } = await import('../lib/soloSession')
    saveSoloSetupPreferences({
      datasetId: 'ds-1',
      difficulty: ['easy'],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 45_000,
      clueRevealIntervalMs: 5_000
    })

    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('button', { name: /start endurance/i })).toBeEnabled())
    expect(screen.getByLabelText(/card timer/i)).toHaveValue('45')
    expect(screen.getByLabelText(/new clue every/i)).toHaveValue('5')
    expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^any$/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
