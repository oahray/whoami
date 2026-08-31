import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { resetInPersonCardCacheForTests } from '../lib/inPersonCardFetch'
import { saveSoloSession } from '../lib/soloSession'
import SoloGame from './SoloGame'

function renderSoloPlay() {
  return render(
    <PreferencesProvider>
      <MemoryRouter initialEntries={['/solo/play']}>
        <Routes>
          <Route path="/solo/play" element={<SoloGame />} />
          <Route path="/solo" element={<div>Solo setup</div>} />
        </Routes>
      </MemoryRouter>
    </PreferencesProvider>
  )
}

async function flushCardLoad() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('SoloGame', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    resetInPersonCardCacheForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input) => {
        const url = String(input)
        if (url.includes('/maintenance/status')) {
          return {
            ok: true,
            json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
          } as Response
        }
        return {
          ok: true,
          json: async () => ({
            entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: ['Moshe'] },
            clues: [{ order: 1, text: 'A clue', citations: 'Exodus 2:1' }]
          })
        } as Response
      })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the answer and citations after Endurance timeout, then the results', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 100,
      clueRevealIntervalMs: 100,
      entityIds: ['ent-1'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    renderSoloPlay()
    await flushCardLoad()
    expect(screen.getByText('A clue')).toBeInTheDocument()
    expect(screen.queryByText('Exodus 2:1')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(screen.getByText(/time's up/i)).toBeInTheDocument()
    expect(screen.getByText('Moses')).toBeInTheDocument()
    expect(screen.getByText('Moshe')).toBeInTheDocument()
    expect(screen.getByText('Exodus 2:1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /see results/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /endurance complete/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /see results/i }))

    expect(screen.getByRole('heading', { name: /endurance complete/i })).toBeInTheDocument()
  })

  it('does not auto-advance Endurance after correct; waits for Next round', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      entityIds: ['ent-1', 'ent-2'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: {
            id: url.includes('ent-2') ? 'ent-2' : 'ent-1',
            name: url.includes('ent-2') ? 'Aaron' : 'Moses',
            type: 'character',
            aliases: []
          },
          clues: [{ order: 1, text: url.includes('ent-2') ? 'New clue' : 'A clue', citations: null }]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    fireEvent.change(screen.getByPlaceholderText(/enter your guess/i), { target: { value: 'Moses' } })
    fireEvent.click(screen.getByRole('button', { name: /^guess$/i }))

    expect(screen.getByRole('button', { name: /next round/i })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(screen.getByText(/correct!/i)).toBeInTheDocument()
    expect(screen.queryByText('New clue')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next round/i }))
    await flushCardLoad()
    expect(screen.getByText('New clue')).toBeInTheDocument()
  })

  it('does not auto-advance Challenge after timeout', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 100,
      clueRevealIntervalMs: 100,
      entityIds: ['ent-1', 'ent-2'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    renderSoloPlay()
    await flushCardLoad()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.getByText(/time's up/i)).toBeInTheDocument()
    expect(screen.getByText('Exodus 2:1')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(screen.getByText(/time's up/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next round/i })).toBeInTheDocument()
  })

  it('shows citations after a correct guess and waits for Next in Challenge', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      entityIds: ['ent-1', 'ent-2'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: {
            id: url.includes('ent-2') ? 'ent-2' : 'ent-1',
            name: url.includes('ent-2') ? 'Aaron' : 'Moses',
            type: 'character',
            aliases: url.includes('ent-2') ? [] : ['Moshe']
          },
          clues: [
            {
              order: 1,
              text: url.includes('ent-2') ? 'New clue' : 'A clue',
              citations: url.includes('ent-2') ? null : 'Exodus 2:1'
            }
          ]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    fireEvent.change(screen.getByPlaceholderText(/enter your guess/i), { target: { value: 'Moses' } })
    fireEvent.click(screen.getByRole('button', { name: /^guess$/i }))

    expect(screen.getByText(/correct!/i)).toBeInTheDocument()
    expect(screen.getByText('Moshe')).toBeInTheDocument()
    expect(screen.getByText('Exodus 2:1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next round/i })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(screen.getByText(/correct!/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next round/i }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('New clue')).toBeInTheDocument()
  })

  it('restarts with the same setup when Try again is pressed', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 100,
      clueRevealIntervalMs: 100,
      entityIds: ['ent-1'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      if (url.includes('/cards/deck')) {
        return {
          ok: true,
          json: async () => ({ entityIds: ['ent-2', 'ent-3'] })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: {
            id: url.includes('ent-2') ? 'ent-2' : 'ent-1',
            name: url.includes('ent-2') ? 'Aaron' : 'Moses',
            type: 'character',
            aliases: []
          },
          clues: [{ order: 1, text: url.includes('ent-2') ? 'New clue' : 'A clue', citations: null }]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    fireEvent.click(screen.getByRole('button', { name: /next round/i }))

    expect(screen.getByRole('heading', { name: /challenge complete/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new setup/i })).toHaveAttribute('href', '/solo')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('New clue')).toBeInTheDocument()
    expect(screen.queryByText('Solo setup')).not.toBeInTheDocument()
  })

  it('ends the run when the next card is gone after a settle', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      entityIds: ['ent-1', 'ent-2'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      if (url.includes('ent-2')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Card not found', code: 'ENTITY_NOT_FOUND' })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [{ order: 1, text: 'A clue', citations: null }]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    fireEvent.change(screen.getByPlaceholderText(/enter your guess/i), { target: { value: 'Moses' } })
    fireEvent.click(screen.getByRole('button', { name: /^guess$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next round/i }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('heading', { name: /challenge complete/i })).toBeInTheDocument()
    expect(screen.getByText(/score so far is saved/i)).toBeInTheDocument()
  })

  it('keeps the stored clue order on refresh instead of a reshuffled fetch', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'challenge',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 10_000,
      entityIds: ['ent-1'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0,
      roundStartedAt: Date.now() - 15_000,
      roundStatus: 'active',
      currentCard: {
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
        clues: [
          { order: 1, text: 'Frozen first clue', citations: null },
          { order: 2, text: 'Frozen second clue', citations: null }
        ]
      }
    })

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [
            { order: 1, text: 'Reshuffled first clue', citations: null },
            { order: 2, text: 'Reshuffled second clue', citations: null }
          ]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    expect(screen.getByText('Frozen first clue')).toBeInTheDocument()
    expect(screen.getByText('Frozen second clue')).toBeInTheDocument()
    expect(screen.queryByText('Reshuffled first clue')).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/cards/entity/'))).toBe(
      false
    )
  })

  it('keeps frozen timer and clue count on refresh after an early correct guess', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 5_000,
      entityIds: ['ent-1'],
      index: 0,
      correctCount: 1,
      activeElapsedMs: 5_000,
      roundStartedAt: Date.now() - 20_000,
      roundRemainingMs: 25_000,
      roundStatus: 'correct',
      currentCard: {
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: null },
          { order: 3, text: 'Third clue', citations: null },
          { order: 4, text: 'Fourth clue', citations: null }
        ]
      }
    })

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [
            { order: 1, text: 'Should not load', citations: null },
            { order: 2, text: 'Should not load either', citations: null }
          ]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    expect(screen.getByText('First clue')).toBeInTheDocument()
    expect(screen.getByText('Second clue')).toBeInTheDocument()
    expect(screen.queryByText('Third clue')).not.toBeInTheDocument()
    expect(screen.getByText(/correct!/i)).toBeInTheDocument()
    expect(screen.getByText('25s')).toBeInTheDocument()
  })

  it('does not fetch the next endurance card while sitting on a timeout reveal', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 100,
      clueRevealIntervalMs: 100,
      entityIds: ['ent-1', 'ent-2'],
      index: 0,
      correctCount: 0,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          entity: {
            id: url.includes('ent-2') ? 'ent-2' : 'ent-1',
            name: url.includes('ent-2') ? 'Aaron' : 'Moses',
            type: 'character',
            aliases: []
          },
          clues: [
            {
              order: 1,
              text: url.includes('ent-2') ? 'Next card clue' : 'A clue',
              citations: url.includes('ent-2') ? null : 'Exodus 2:1'
            }
          ]
        })
      } as Response
    })

    renderSoloPlay()
    await flushCardLoad()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(screen.getByText(/time's up/i)).toBeInTheDocument()
    expect(screen.queryByText('Next card clue')).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('ent-2'))).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /see results/i }))
    expect(screen.getByRole('heading', { name: /endurance complete/i })).toBeInTheDocument()
  })
})
