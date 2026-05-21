import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayCards from './PlayCards'

describe('PlayCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('loads a card and reveals the next clue', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: ['Moshe'] },
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: 'Exodus 3:1' }
        ]
      })
    } as Response)

    render(
      <MemoryRouter initialEntries={['/play/cards?datasetId=ds-1&difficulty=any']}>
        <Routes>
          <Route path="/play/cards" element={<PlayCards />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })
    expect(screen.queryByText('Second clue')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next clue/i }))

    expect(screen.getByText('Second clue')).toBeInTheDocument()
    expect(screen.queryByText('Exodus 3:1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('Exodus 3:1')).toBeInTheDocument()
  })

  it('masks the character until reveal answer, then allows more clues', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: ['Moshe'] },
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: null },
          { order: 3, text: 'Third clue', citations: null }
        ]
      })
    } as Response)

    render(
      <MemoryRouter initialEntries={['/play/cards?datasetId=ds-1']}>
        <Routes>
          <Route path="/play/cards" element={<PlayCards />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })

    expect(screen.queryByText('Moses')).not.toBeInTheDocument()
    expect(screen.queryByText('Moshe')).not.toBeInTheDocument()
    expect(screen.getAllByText('*****')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('Moses')).toBeInTheDocument()
    expect(screen.getByText('Moshe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next clue/i }))
    expect(screen.getByText('Second clue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next clue/i })).toBeInTheDocument()
  })

  it('shows error on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'No cards available', code: 'NO_CARDS' })
    } as Response)

    render(
      <MemoryRouter initialEntries={['/play/cards?datasetId=ds-1']}>
        <Routes>
          <Route path="/play/cards" element={<PlayCards />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/no cards available/i)).toBeInTheDocument()
    })
  })
})
