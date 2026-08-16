import { DEFAULT_MULTIPLAYER_SETTINGS } from '../lib/multiplayerDefaults'
import { act, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
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
        ...DEFAULT_MULTIPLAYER_SETTINGS,
        maxGuessesPerRound: 10
      },
      gameState: null,
      gameHistory: [],
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

  it('shows copied feedback after copying the invite link when share is unavailable', async () => {
    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTitle('Share invite'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/?room=ABC123`)
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('opens the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true
    })

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTitle('Share invite'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(share).toHaveBeenCalledWith({
      title: 'Who Am I?',
      text: 'Join my Who Am I? room (ABC123)',
      url: `${window.location.origin}/?room=ABC123`
    })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(screen.getByText('Shared!')).toBeInTheDocument()
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
      { id: 'ds-2', name: 'Org History', source: 'Wiki', description: null, is_default: false }
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
    expect(screen.getByRole('option', { name: /Org History \(Wiki\)/ })).toBeInTheDocument()
  })

  it('emits UPDATE_SETTINGS with datasetId when host changes the picker', async () => {
    mockDatasetsFetch([
      { id: 'ds-1', name: 'Bible', source: 'NWT', description: null, is_default: true },
      { id: 'ds-2', name: 'Org History', source: 'Wiki', description: null, is_default: false }
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

    expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^medium$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^hard$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^nightmare$/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /^hard$/i }))

    expect(emit).toHaveBeenCalledWith('UPDATE_SETTINGS', { difficultyMode: 'easy,medium,nightmare' })
  })

  it('emits LOBBY_REACTION when a reaction button is pressed', () => {
    const emit = vi.fn()
    mockUseSocket.mockReturnValue({ emit, on: vi.fn(), off: vi.fn() })

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /^ready$/i }))

    expect(emit).toHaveBeenCalledWith('LOBBY_REACTION', { reactionId: 'ready' })
  })

  it('shows a reaction chip on the player row and clears it after the TTL', () => {
    const handlers = new Map<string, (payload: unknown) => void>()
    mockUseSocket.mockReturnValue({
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler)
      }),
      off: vi.fn()
    })

    renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    act(() => {
      handlers.get('LOBBY_REACTION')?.({ playerId: 'p2', reactionId: 'nice' })
    })

    expect(screen.getByTestId('lobby-reaction-chip-p2')).toHaveTextContent('Nice')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByTestId('lobby-reaction-chip-p2')).not.toBeInTheDocument()
  })

  it('removes a reaction chip when that player disconnects', () => {
    const handlers = new Map<string, (payload: unknown) => void>()
    mockUseSocket.mockReturnValue({
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler)
      }),
      off: vi.fn()
    })

    const { rerender } = renderWithPreferences(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>
    )

    act(() => {
      handlers.get('LOBBY_REACTION')?.({ playerId: 'p2', reactionId: 'wait' })
    })
    expect(screen.getByTestId('lobby-reaction-chip-p2')).toBeInTheDocument()

    mockUseGame.mockReturnValue({
      roomCode: 'ABC123',
      isHost: true,
      players: [{ id: 'host', nickname: 'Host', isHost: true, isConnected: true }],
      settings: {
        ...DEFAULT_MULTIPLAYER_SETTINGS,
        maxGuessesPerRound: 10
      },
      gameState: null,
      gameHistory: [],
      error: null,
      setError: vi.fn(),
      reset: vi.fn(),
      playerId: 'host'
    })

    act(() => {
      rerender(
        <PreferencesProvider>
          <MemoryRouter>
            <Lobby />
          </MemoryRouter>
        </PreferencesProvider>
      )
    })

    expect(screen.queryByTestId('lobby-reaction-chip-p2')).not.toBeInTheDocument()
  })
})
