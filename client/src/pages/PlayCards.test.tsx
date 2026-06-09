import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { saveDeckSession } from '../lib/inPersonDeck'
import PlayCards from './PlayCards'

function renderPlayCards(initialEntry: string) {
  return render(
    <PreferencesProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/play/cards" element={<PlayCards />} />
          <Route path="/play" element={<div>Setup</div>} />
        </Routes>
      </MemoryRouter>
    </PreferencesProvider>
  )
}

describe('PlayCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    saveDeckSession({
      datasetId: 'ds-1',
      difficulty: 'any',
      entityType: 'character',
      entityIds: ['ent-1', 'ent-2'],
      index: 0
    })
  })

  function mockEntityCard(entityId: string, name: string, clues: InPersonCardClue[]) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        entity: { id: entityId, name, type: 'character', aliases: ['Moshe'] },
        clues
      })
    } as Response)
  }

  it('loads a card from the deck and reveals the next clue', async () => {
    mockEntityCard('ent-1', 'Moses', [
      { order: 1, text: 'First clue', citations: null },
      { order: 2, text: 'Second clue', citations: 'Exodus 3:1' }
    ])

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })
    expect(screen.queryByText('Second clue')).not.toBeInTheDocument()
    expect(screen.queryByText('Exodus 3:1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next clue/i }))
    expect(screen.getByText('Second clue')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('Exodus 3:1')).toBeInTheDocument()
  })

  it('masks the character until reveal answer, then advances deck', async () => {
    mockEntityCard('ent-1', 'Moses', [
      { order: 1, text: 'First clue', citations: null },
      { order: 2, text: 'Second clue', citations: null }
    ])

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })

    expect(screen.queryByText('Moses')).not.toBeInTheDocument()
    expect(screen.getAllByText('*****')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('Moses')).toBeInTheDocument()

    mockEntityCard('ent-2', 'Aaron', [{ order: 1, text: 'Aaron clue', citations: null }])
    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText('Aaron clue')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /next card/i })).toBeInTheDocument()
  })

  it('shows deck complete after the last card', async () => {
    saveDeckSession({
      datasetId: 'ds-1',
      difficulty: 'any',
      entityType: 'character',
      entityIds: ['ent-1'],
      index: 0
    })

    mockEntityCard('ent-1', 'Moses', [{ order: 1, text: 'Only clue', citations: null }])

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('Only clue')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText(/all cards in this deck/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /next card/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shuffle again/i })).toBeInTheDocument()
  })

  it('redirects to setup without a deck session', async () => {
    sessionStorage.clear()
    const mockNavigate = vi.fn()
    vi.doMock('react-router-dom', () => ({
      useNavigate: () => mockNavigate
    }))

    renderPlayCards('/play/cards?datasetId=ds-1')

    await waitFor(() => {
      expect(screen.getByText('Setup')).toBeInTheDocument()
    })
  })

  it('shows error on failed card load', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Card not found', code: 'ENTITY_NOT_FOUND' })
    } as Response)

    renderPlayCards('/play/cards?datasetId=ds-1')

    await waitFor(() => {
      expect(screen.getByText(/card not found/i)).toBeInTheDocument()
    })
  })
})

type InPersonCardClue = { order: number; text: string; citations: string | null }
