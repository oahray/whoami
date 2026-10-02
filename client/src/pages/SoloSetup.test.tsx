import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import { loadSoloSession } from '../lib/soloSession'
import { applyMasteryOutcome } from '../lib/soloMastery'
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
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => [{ id: 'ds-1', name: 'Bible', is_default: true, source: null, description: null }] } as Response
      }
      if (url.includes('/cards/eligibility')) {
        return { ok: true, json: async () => ({ modes: { any: 12, easy: 12, medium: 0, hard: 0, nightmare: 0 } }) } as Response
      }
      if (url.includes('/cards/daily-challenge')) {
        return {
          ok: true,
          json: async () => ({
            challengeId: '2026-10-02-v1',
            challengeVersion: 1,
            dateKey: '2026-10-02',
            datasetId: 'ds-1',
            datasetName: 'Bible',
            difficulty: 'any',
            entityType: 'all',
            roundDurationMs: 30_000,
            clueRevealIntervalMs: 5_000,
            entityIds: Array.from({ length: 10 }, (_, index) => `daily-${index}`),
            scoringVersion: 1,
            scoringRules: {
              basePoints: 1000,
              additionalCluePenalty: 150,
              elapsedSecondPenalty: 10,
              incorrectGuessPenalty: 100,
              minimumCorrectScore: 100
            }
          })
        } as Response
      }
      if (url.includes('/cards/deck')) {
        return { ok: true, json: async () => ({ entityIds: Array.from({ length: 12 }, (_, index) => `ent-${index}`) }) } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  it('starts a ten-round challenge session with the selected timing', async () => {
    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    await waitFor(
      () => expect(screen.getByRole('button', { name: /start 10-round challenge/i })).toBeEnabled(),
      { timeout: 5000 }
    )
    fireEvent.change(screen.getByLabelText(/new clue every/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /start 10-round challenge/i }))

    await waitFor(() => expect(loadSoloSession()).not.toBeNull())
    expect(loadSoloSession()).toMatchObject({
      variation: 'challenge',
      clueRevealIntervalMs: 5000
    })
    expect(loadSoloSession()?.entityIds).toHaveLength(10)
  })

  it('starts today’s fixed challenge with server-provided rules', async () => {
    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    const playToday = await screen.findByRole('button', { name: /play today/i })
    fireEvent.click(playToday)

    expect(loadSoloSession()).toMatchObject({
      variation: 'daily',
      dailyChallengeId: '2026-10-02-v1',
      entityType: 'all',
      roundDurationMs: 30_000,
      scoringVersion: 1,
      scoringRules: { basePoints: 1000 }
    })
    expect(loadSoloSession()?.entityIds).toHaveLength(10)
  })

  it('shows progress and starts Review with eligible missed entities only', async () => {
    applyMasteryOutcome({
      eventId: 'miss-1',
      datasetId: 'ds-1',
      entityId: 'ent-3',
      entityName: 'Moses',
      correct: false,
      revealedClueCount: 4
    })
    applyMasteryOutcome({
      eventId: 'miss-2',
      datasetId: 'ds-1',
      entityId: 'not-in-current-deck',
      entityName: 'Noah',
      correct: false,
      revealedClueCount: 5
    })

    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: /progress/i })).toBeInTheDocument()
    expect(screen.getByText(/how learning works/i)).toBeInTheDocument()
    const review = await screen.findByRole('button', { name: /review 2 missed/i })
    await waitFor(() => expect(review).toBeEnabled())
    fireEvent.click(review)

    await waitFor(() =>
      expect(loadSoloSession()).toMatchObject({
        variation: 'review',
        entityType: 'all',
        entityIds: ['ent-3']
      })
    )
    const deckCall = vi.mocked(fetch).mock.calls.find((call) => String(call[0]).includes('/cards/deck'))
    expect(String(deckCall?.[0])).toContain('difficulty=any')
    expect(String(deckCall?.[0])).toContain('entityType=all')
  })

  it('explains how to unlock Review when nothing needs review yet', async () => {
    renderWithPreferences(<MemoryRouter><SoloSetup /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: /progress/i })).toBeInTheDocument()
    expect(screen.getByText(/miss or time out a card/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /review \d+ missed/i })).not.toBeInTheDocument()
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
    expect(screen.getByText(/7 correct/i)).toBeInTheDocument()
    expect(screen.getByText(/12 correct/i)).toBeInTheDocument()
    expect(screen.getByText(/top 10 per mode/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ago|Jan|2026/i).length).toBeGreaterThan(0)
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

    await waitFor(
      () => expect(screen.getByRole('button', { name: /start endurance/i })).toBeEnabled(),
      { timeout: 5000 }
    )
    expect(screen.getByLabelText(/card timer/i)).toHaveValue('45')
    expect(screen.getByLabelText(/new clue every/i)).toHaveValue('5')
    expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^medium$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^hard$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the current setup selection after refresh before starting', async () => {
    const firstRender = renderWithPreferences(
      <MemoryRouter>
        <SoloSetup />
      </MemoryRouter>
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /start 10-round challenge/i })).toBeEnabled(),
      { timeout: 5000 }
    )

    fireEvent.change(screen.getByLabelText(/card timer/i), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: /endurance/i }))

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /start endurance/i })).toBeEnabled()
      },
      { timeout: 5000 }
    )
    await waitFor(() => {
      expect(localStorage.getItem('whoami-solo-setup')).toContain('"variation":"endurance"')
    })

    firstRender.unmount()

    renderWithPreferences(
      <MemoryRouter>
        <SoloSetup />
      </MemoryRouter>
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /start endurance/i })).toBeEnabled(),
      { timeout: 5000 }
    )
    expect(screen.getByLabelText(/card timer/i)).toHaveValue('45')
    expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^medium$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /start endurance/i })).toBeEnabled()
  })

  it('recovers when datasets first return 500', async () => {
    let datasetCalls = 0
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/datasets')) {
        datasetCalls += 1
        if (datasetCalls === 1) {
          return { ok: false, status: 500, json: async () => ({}) } as Response
        }
        return {
          ok: true,
          json: async () => [{ id: 'ds-1', name: 'Bible', is_default: true, source: null, description: null }]
        } as Response
      }
      if (url.includes('/cards/eligibility')) {
        return {
          ok: true,
          json: async () => ({ modes: { any: 12, easy: 12, medium: 0, hard: 0, nightmare: 0 } })
        } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderWithPreferences(
      <MemoryRouter>
        <SoloSetup />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start 10-round challenge/i })).toBeEnabled()
    )
    expect(screen.queryByText(/failed to load content/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(500\)/)).not.toBeInTheDocument()
    expect(datasetCalls).toBe(2)
  })

  it('shows a friendly message when datasets keep failing', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/datasets')) {
        return { ok: false, status: 500, json: async () => ({}) } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderWithPreferences(
      <MemoryRouter>
        <SoloSetup />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(screen.getByText(/couldn't load game content/i)).toBeInTheDocument()
    )
    expect(screen.queryByText(/\(500\)/)).not.toBeInTheDocument()
    expect(screen.queryByText(/failed to load content/i)).not.toBeInTheDocument()
  })
})
