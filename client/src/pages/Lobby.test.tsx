import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Lobby from './Lobby'

const mockUseGame = vi.fn()
const mockUseSocket = vi.fn()

vi.mock('../hooks/useGame', () => ({
  useGame: () => mockUseGame()
}))

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket()
}))

describe('Lobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

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
    render(
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
    render(
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
})
