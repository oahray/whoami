import { DEFAULT_MULTIPLAYER_SETTINGS } from '../lib/multiplayerDefaults'
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
          <div data-testid="error">{value?.error ?? ''}</div>
          <div data-testid="reconnecting">{value?.isReconnecting ? 'yes' : 'no'}</div>
          <div data-testid="is-host">{value?.isHost ? 'yes' : 'no'}</div>
          <div data-testid="host-nicknames">
            {(value?.players ?? []).filter((p) => p.isHost).map((p) => p.nickname).join(',')}
          </div>
          <div data-testid="scoreboard">{JSON.stringify(value?.gameState?.currentScoreboard ?? [])}</div>
          <div data-testid="round">{value?.gameState?.roundNumber ?? ''}</div>
          <div data-testid="clues">{JSON.stringify(value?.gameState?.cluesRevealed ?? [])}</div>
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

  it('clears connection errors when the socket reconnects', () => {
    const socket = createMockSocket(false)
    mockUseSocket.mockReturnValue({ socket })

    render(
      <GameProvider>
        <TestConsumer />
      </GameProvider>
    )

    act(() => {
      socket.handlers.reconnect_failed?.()
    })
    expect(screen.getByTestId('error')).toHaveTextContent(/could not reach the server/i)

    act(() => {
      socket.handlers.connect?.()
    })
    expect(screen.getByTestId('error')).toHaveTextContent('')
  })

  it('clears reconnecting state on fatal room errors so Home is not blocked', () => {
    const socket = createMockSocket(true)
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
    expect(screen.getByTestId('reconnecting')).toHaveTextContent('yes')

    act(() => {
      socket.handlers.ROOM_ERROR?.({ code: 'ROOM_NOT_FOUND', message: 'gone' })
    })

    expect(screen.getByTestId('reconnecting')).toHaveTextContent('no')
    expect(screen.getByTestId('room-code')).toHaveTextContent('')
    expect(screen.getByTestId('error')).toHaveTextContent(/no longer exists/i)
    expect(localStorage.getItem('whoami_room')).toBeNull()
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
          ...DEFAULT_MULTIPLAYER_SETTINGS,
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

  it('keeps the next round first clue after the inter-round delay', () => {
    vi.useFakeTimers()
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
        players: [{ id: 'host', nickname: 'Host', isHost: true, isConnected: true }],
        settings: {
          ...DEFAULT_MULTIPLAYER_SETTINGS,
          maxGuessesPerRound: 10
        },
        roomCode: 'ABC123'
      })
    })

    act(() => {
      socket.handlers.ROUND_STARTED?.({
        roundNumber: 1,
        serverStartTime: 1,
        clue: { order: 1, text: 'First round clue' },
        currentScoreboard: [{ playerId: 'host', nickname: 'Host', score: 0 }]
      })
    })

    act(() => {
      socket.handlers.ROUND_ENDED?.({
        answerRevealed: true,
        answer: 'Moses',
        scoreboard: [{ playerId: 'host', nickname: 'Host', totalScore: 10 }]
      })
    })

    act(() => {
      socket.handlers.ROUND_STARTED?.({
        roundNumber: 2,
        serverStartTime: 2,
        clue: { order: 1, text: 'Second round clue' },
        currentScoreboard: [{ playerId: 'host', nickname: 'Host', score: 10 }]
      })
    })

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(screen.getByTestId('clues')).toHaveTextContent('Second round clue')
    expect(screen.getByTestId('round')).toHaveTextContent('2')

    vi.useRealTimers()
  })

  it('grants local host rights when host transfer arrives via PLAYER_LEFT', () => {
    const socket = createMockSocket(true)
    mockUseSocket.mockReturnValue({ socket })

    render(
      <GameProvider>
        <TestConsumer />
      </GameProvider>
    )

    act(() => {
      socket.handlers.ROOM_JOINED?.({
        playerId: 'p2',
        isHost: false,
        players: [
          { id: 'host', nickname: 'Host', isHost: true, isConnected: true },
          { id: 'p2', nickname: 'Paul', isHost: false, isConnected: true }
        ],
        settings: {
          ...DEFAULT_MULTIPLAYER_SETTINGS,
          maxGuessesPerRound: 10
        },
        roomCode: 'ABC123'
      })
    })

    expect(screen.getByTestId('is-host')).toHaveTextContent('no')

    act(() => {
      socket.handlers.PLAYER_LEFT?.({
        id: 'host',
        nickname: 'Host',
        newHost: 'Paul',
        reason: 'left'
      })
    })

    expect(screen.getByTestId('is-host')).toHaveTextContent('yes')
    expect(screen.getByTestId('host-nicknames')).toHaveTextContent('Paul')
  })
})
