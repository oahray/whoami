import { act, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import Lobby from './Lobby'

const mockUseGame = vi.fn()
const mockUseSocket = vi.fn()

vi.mock('../hooks/useGame', () => ({
  useGame: () => mockUseGame()
}))

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket()
}))

function mockDatasetsFetch(rows: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rows
    } as unknown as Response)
  )
}

describe('Lobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    window.sessionStorage.clear()
    mockDatasetsFetch([])

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      configurable: true
    })

    mockUseGame.mockReturnValue({
      roomCode: 'ABC123',
      isHost: true,
      players: [
        { id: 'host', nickname: 'Host', isHost: true, isConnected: true },
        { id: 'p2', nickname: 'Paul', isHost: false, isConnected: true }
      ],
      settings: {
        totalRounds: 5,
        roundDuration: 30000,
        clueRevealTime: 10000,
        difficultyMode: 'any',
        strictMode: false,
        transparencyMode: 'full',
        maxGuessesPerRound: 10,
        datasetId: null
      },
      gameState: null,
      error: null,
      setError: vi.fn(),
      reset: vi.fn(),
      playerId: 'host'
    })

    mockUseSocket.mockReturnValue({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows copied feedback after copying the room code', async () => {
    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTitle('Copy code'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABC123')
    expect(screen.getByText('Copied!')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('Copy Code')).toBeInTheDocument()
  })

  it('shows copied feedback after copying the invite link', async () => {
    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTitle('Copy link'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/?room=ABC123`)
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('hides the dataset picker when there is at most one enabled dataset', async () => {
    mockDatasetsFetch([
      { id: 'ds-1', name: 'Bible', source: 'NWT', description: null, is_default: true }
    ])

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByLabelText('Content')).not.toBeInTheDocument()
  })

  it('shows a dataset picker when there are 2+ enabled datasets', async () => {
    mockDatasetsFetch([
      { id: 'ds-1', name: 'Bible', source: 'NWT', description: null, is_default: true },
      { id: 'ds-2', name: 'Org History', source: 'JW.org', description: null, is_default: false }
    ])

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByLabelText('Content')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Org History — JW\.org/ })).toBeInTheDocument()
  })

  it('emits UPDATE_SETTINGS with datasetId when host changes the picker', async () => {
    mockDatasetsFetch([
      { id: 'ds-1', name: 'Bible', source: 'NWT', description: null, is_default: true },
      { id: 'ds-2', name: 'Org History', source: 'JW.org', description: null, is_default: false }
    ])

    const emit = vi.fn()
    mockUseSocket.mockReturnValue({ emit, on: vi.fn(), off: vi.fn() })

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const select = screen.getByLabelText('Content') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'ds-2' } })

    expect(emit).toHaveBeenCalledWith('UPDATE_SETTINGS', { datasetId: 'ds-2' })
  })

  it('renders a difficulty picker and emits UPDATE_SETTINGS when the host changes it', () => {
    const emit = vi.fn()
    mockUseSocket.mockReturnValue({ emit, on: vi.fn(), off: vi.fn() })

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    const difficultySelect = screen.getByLabelText('Difficulty') as HTMLSelectElement
    expect(difficultySelect.value).toBe('any')

    fireEvent.change(difficultySelect, { target: { value: 'hard' } })

    expect(emit).toHaveBeenCalledWith('UPDATE_SETTINGS', { difficultyMode: 'hard' })
  })
})
