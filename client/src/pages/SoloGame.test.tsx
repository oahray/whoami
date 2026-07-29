import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [{ order: 1, text: 'A clue', citations: 'Exodus 2:1' }]
        })
      } as Response)
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
    expect(screen.getByText('Exodus 2:1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /see results/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /endurance complete/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /see results/i }))

    expect(screen.getByRole('heading', { name: /endurance complete/i })).toBeInTheDocument()
  })

  it('auto-advances Endurance after 10s on timeout but allows early next', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: [],
      entityType: 'character',
      variation: 'endurance',
      roundDurationMs: 100,
      clueRevealIntervalMs: 100,
      entityIds: ['ent-1'],
      index: 0,
      correctCount: 2,
      activeElapsedMs: 0
    })
    vi.useFakeTimers()

    renderSoloPlay()
    await flushCardLoad()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.getByText(/time's up/i)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000)
    })
    expect(screen.queryByRole('heading', { name: /endurance complete/i })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(screen.getByRole('heading', { name: /endurance complete/i })).toBeInTheDocument()
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
})
