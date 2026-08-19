import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { resetInPersonCardCacheForTests } from '../lib/inPersonCardFetch'
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

function saveTestSession(
  masterPool: string[],
  overrides: {
    deckStartOffset?: number
    index?: number
    history?: Parameters<typeof saveDeckSession>[0]['history']
  } = {}
) {
  saveDeckSession({
    datasetId: 'ds-1',
    difficulty: [],
    entityType: 'character',
    masterPool,
    deckStartOffset: 0,
    index: 0,
    history: [],
    ...overrides
  })
}

type InPersonCardClue = { order: number; text: string; citations: string | null }

function stubEntityCards(
  cards: Record<string, { name: string; clues: InPersonCardClue[]; aliases?: string[] }>
) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/maintenance/status')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
      } as Response
    }
    for (const [entityId, card] of Object.entries(cards)) {
      if (url.includes(`/cards/entity/${entityId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entity: {
              id: entityId,
              name: card.name,
              type: 'character',
              aliases: card.aliases ?? ['Moshe']
            },
            clues: card.clues
          })
        } as Response
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Card not found', code: 'ENTITY_NOT_FOUND' })
    } as Response
  })
}

describe('PlayCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    resetInPersonCardCacheForTests()
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    saveTestSession(['ent-1', 'ent-2'])
  })

  it('loads a card from the deck and reveals the next clue', async () => {
    stubEntityCards({
      'ent-1': {
        name: 'Moses',
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: 'Exodus 3:1' }
        ]
      },
      'ent-2': { name: 'Aaron', clues: [{ order: 1, text: 'Aaron clue', citations: null }] }
    })

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
    stubEntityCards({
      'ent-1': {
        name: 'Moses',
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: null }
        ]
      },
      'ent-2': { name: 'Aaron', clues: [{ order: 1, text: 'Aaron clue', citations: null }], aliases: [] }
    })

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })

    expect(screen.queryByText('Moses')).not.toBeInTheDocument()
    expect(screen.getAllByText('*****')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('Moses')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText('Aaron clue')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /next card/i })).toBeInTheDocument()
  })

  it('shows deck complete with next deck when more characters remain', async () => {
    const pool = Array.from({ length: 12 }, (_, i) => `ent-${i + 1}`)
    saveTestSession(pool, { index: 9 })

    stubEntityCards({
      'ent-10': { name: 'Tenth', clues: [{ order: 1, text: 'Tenth clue', citations: null }], aliases: [] },
      'ent-11': { name: 'Eleventh', clues: [{ order: 1, text: 'Eleventh clue', citations: null }], aliases: [] }
    })

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('Tenth clue')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText(/all cards in this deck/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/2 characters remaining/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next deck/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument()
  })

  it('shows play again after the last deck in the session', async () => {
    saveTestSession(['ent-1'], { index: 0 })

    stubEntityCards({
      'ent-1': { name: 'Moses', clues: [{ order: 1, text: 'Only clue', citations: null }], aliases: [] }
    })

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('Only clue')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText(/every character in this session/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next deck/i })).not.toBeInTheDocument()
  })

  it('restores previous card clues and reveal state from history', async () => {
    stubEntityCards({
      'ent-1': {
        name: 'Moses',
        clues: [
          { order: 1, text: 'First clue', citations: null },
          { order: 2, text: 'Second clue', citations: null }
        ]
      },
      'ent-2': {
        name: 'Aaron',
        clues: [
          { order: 1, text: 'Aaron first', citations: null },
          { order: 2, text: 'Aaron second', citations: null }
        ],
        aliases: []
      }
    })

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /next clue/i }))
    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText('Aaron first')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /previous card/i }))

    await waitFor(() => {
      expect(screen.getByText('Second clue')).toBeInTheDocument()
    })
    expect(screen.getByText('Moses')).toBeInTheDocument()
    expect(screen.queryByText('Aaron first')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('redirects to setup without a deck session', async () => {
    sessionStorage.clear()

    renderPlayCards('/play/cards?datasetId=ds-1')

    await waitFor(() => {
      expect(screen.getByText('Setup')).toBeInTheDocument()
    })
  })

  it('shows error on failed card load', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Card not found', code: 'ENTITY_NOT_FOUND' })
      } as Response
    })

    renderPlayCards('/play/cards?datasetId=ds-1')

    await waitFor(() => {
      expect(screen.getByText(/card not found/i)).toBeInTheDocument()
    })
  })

  it('keeps the current card when the next entity is gone', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/maintenance/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ phase: 'none', endsAt: null, startsAt: null })
        } as Response
      }
      if (url.includes('/cards/entity/ent-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
            clues: [{ order: 1, text: 'First clue', citations: null }]
          })
        } as Response
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Card not found', code: 'ENTITY_NOT_FOUND' })
      } as Response
    })

    renderPlayCards('/play/cards?datasetId=ds-1&difficulty=any')

    await waitFor(() => {
      expect(screen.getByText('First clue')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /next card/i }))

    await waitFor(() => {
      expect(screen.getByText(/can't load the next card/i)).toBeInTheDocument()
    })
    expect(screen.getByText('First clue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next card/i })).toBeDisabled()
  })
})
