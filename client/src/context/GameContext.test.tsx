import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, GameProvider } from './GameContext'

const mockUseSocket = vi.fn()

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket()
}))

type HandlerMap = Record<string, ((payload?: any) => void) | undefined>

function createMockSocket(connected = false) {
  const handlers: HandlerMap = {}

  return {
    connected,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (payload?: any) => void) => {
      handlers[event] = handler
    }),
    off: vi.fn((event: string) => {
      delete handlers[event]
    }),
    handlers
  }
}

function TestConsumer() {
  return (
    <GameContext.Consumer>
      {(value) => (
        <div>
          <div data-testid="room-code">{value?.roomCode ?? ''}</div>
          <div data-testid="scoreboard">{JSON.stringify(value?.gameState?.currentScoreboard ?? [])}</div>
          <div data-testid="round">{value?.gameState?.roundNumber ?? ''}</div>
        </div>
      )}
    </GameContext.Consumer>
  )
}

describe('GameProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('re-attempts joining the stored room when socket connects', () => {
    const socket = createMockSocket(false)
    mockUseSocket.mockReturnValue({ socket })

    localStorage.setItem('whoami_room', JSON.stringify({
      roomCode: 'ABC123',
      nickname: 'Paul'
    }))

    render(
      <GameProvider>
        <TestConsumer />
      </GameProvider>
    )

    act(() => {
      socket.handlers.connect?.()
    })

    expect(socket.emit).toHaveBeenCalledWith('JOIN_ROOM', {
      roomCode: 'ABC123',
      nickname: 'Paul'
    })
  })

  it('uses the server-provided scoreboard on ROUND_STARTED', () => {
    const socket = createMockSocket(true)
    mockUseSocket.mockReturnValue({ socket })

    render(
      <GameProvider>
        <TestConsumer />
      </GameProvider>
    )

    act(() => {
      socket.handlers.ROOM_JOINED?.({
        playerId: 'host',
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
          maxGuessesPerRound: 10
        },
        roomCode: 'ABC123'
      })
    })

    act(() => {
      socket.handlers.ROUND_STARTED?.({
        roundNumber: 2,
        serverStartTime: 12345,
        clue: { order: 1, text: 'Led Israel out of Egypt' },
        currentScoreboard: [
          { playerId: 'p2', nickname: 'Paul', score: 250 },
          { playerId: 'host', nickname: 'Host', score: 100 }
        ]
      })
    })

    expect(screen.getByTestId('room-code')).toHaveTextContent('ABC123')
    expect(screen.getByTestId('round')).toHaveTextContent('2')
    expect(screen.getByTestId('scoreboard')).toHaveTextContent(
      JSON.stringify([
        { playerId: 'p2', nickname: 'Paul', score: 250 },
        { playerId: 'host', nickname: 'Host', score: 100 }
      ])
    )
  })
})
