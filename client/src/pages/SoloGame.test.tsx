import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { saveSoloSession } from '../lib/soloSession'
import SoloGame from './SoloGame'

describe('SoloGame', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
        clues: [{ order: 1, text: 'A clue', citations: null }]
      })
    } as Response))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('finishes Endurance and shows the result after a timeout', async () => {
    saveSoloSession({
      datasetId: 'ds-1',
      difficulty: 'any',
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

    render(
      <PreferencesProvider>
        <MemoryRouter initialEntries={['/solo/play']}>
          <Routes>
            <Route path="/solo/play" element={<SoloGame />} />
            <Route path="/solo" element={<div>Solo setup</div>} />
          </Routes>
        </MemoryRouter>
      </PreferencesProvider>
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('A clue')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(screen.getByRole('heading', { name: /endurance complete/i })).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
