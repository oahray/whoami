import { createContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useSocket } from '../hooks/useSocket'
import { getErrorMessage, isFatalError } from '../utils/errorMessages'

interface Player {
  id: string
  nickname: string
  isHost: boolean
  isConnected: boolean
}

interface RoomSettings {
  roundDuration: number
  roundStartDelayMs?: number
  clueRevealTime: number
  totalRounds: number
  difficultyMode: string
  strictMode: boolean
  transparencyMode: 'full' | 'minimal'
  maxGuessesPerRound: number
}

interface GameState {
  phase: 'starting' | 'active' | 'clue_revealed' | 'ended'
  roundNumber: number
  cluesRevealed: Array<{ order: number; text: string }>
  isLocked: boolean
  currentScoreboard: Array<{ playerId: string; nickname: string; score: number }>
  serverStartTime?: number
}

interface GameContextType {
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  players: Player[]
  settings: RoomSettings | null
  gameState: GameState | null
  error: string | null
  isReconnecting: boolean
  setRoomCode: (code: string | null) => void
  setPlayerId: (id: string | null) => void
  setIsHost: (host: boolean) => void
  setPlayers: (players: Player[]) => void
  setSettings: (settings: RoomSettings | null) => void
  setGameState: (state: GameState | null) => void
  setError: (error: string | null) => void
  setIsReconnecting: (reconnecting: boolean) => void
  reset: () => void
  navigateToGame: () => void
}

export const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket()
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [settings, setSettings] = useState<RoomSettings | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const reset = () => {
    setRoomCode(null)
    setPlayerId(null)
    setIsHost(false)
    setPlayers([])
    setSettings(null)
    setGameState(null)
    setError(null)
    setIsReconnecting(false)
    localStorage.removeItem('whoami_room')
  }

  useEffect(() => {
    if (!socket) return

    const attemptReconnect = () => {
      const stored = localStorage.getItem('whoami_room')
      if (stored) {
        try {
          const roomData = JSON.parse(stored)
          if (roomData.roomCode && roomData.nickname) {
            setIsReconnecting(true)
            socket.emit('JOIN_ROOM', {
              roomCode: roomData.roomCode,
              nickname: roomData.nickname
            })
          }
        } catch (e) {
          localStorage.removeItem('whoami_room')
        }
      }
    }

    const handleConnect = () => {
      setIsReconnecting(false)
      // Re-join room when socket reconnects (e.g. after tab was backgrounded), so we don't stay disconnected
      attemptReconnect()
    }

    const handleDisconnect = () => {
      if (roomCode) {
        setIsReconnecting(true)
        setError(getErrorMessage('CONNECTION_LOST'))

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!socket.connected) {
            setError(getErrorMessage('RECONNECTION_FAILED'))
            setIsReconnecting(false)
            localStorage.removeItem('whoami_room')
            reset()
          }
        }, 30000)
      }
    }

    if (socket.connected && !roomCode) {
      attemptReconnect()
    }

    const handleRoomJoined = (data: any) => {
      setPlayerId(data.playerId)
      setIsHost(data.isHost)
      setPlayers(data.players)
      setSettings(data.settings)
      setIsReconnecting(false)
      if (data.roomCode) {
        setRoomCode(data.roomCode)
        const player = data.players.find((p: Player) => p.id === data.playerId)
        if (player) {
          localStorage.setItem('whoami_room', JSON.stringify({
            roomCode: data.roomCode,
            nickname: player.nickname,
            playerId: data.playerId,
            isHost: data.isHost
          }))
        }
      }
      setError(null)
    }

    const handlePlayerJoined = (data: { id: string; nickname: string }) => {
      setPlayers(prev => [...prev, { id: data.id, nickname: data.nickname, isHost: false, isConnected: true }])
    }

    const handlePlayerLeft = (data: { id: string; nickname: string; newHost: string | null }) => {
      setPlayers(prev => prev.filter(p => p.id !== data.id))
      if (data.newHost) {
        setPlayers(prev => prev.map(p => ({ ...p, isHost: p.nickname === data.newHost })))
      }
    }

    const handlePlayerReconnected = (data: { id: string; nickname: string; players?: Array<{ id: string; nickname: string; isHost: boolean; isConnected: boolean }> }) => {
      if (data.players) {
        setPlayers(data.players)
      } else {
        setPlayers(prev => {
          const existing = prev.find(p => p.nickname === data.nickname)
          if (existing) {
            return prev.map(p => p.nickname === data.nickname ? { ...p, id: data.id, isConnected: true } : p)
          }
          return [...prev, { id: data.id, nickname: data.nickname, isHost: false, isConnected: true }]
        })
      }
    }

    const handleSettingsUpdated = (newSettings: RoomSettings) => {
      setSettings(newSettings)
      setError(null)
    }

    const handleReconnectSuccess = (data: any) => {
      setPlayerId(data.playerId)
      setIsHost(data.isHost)
      setPlayers(data.players)
      setSettings(data.settings)
      const player = data.players.find((p: Player) => p.id === data.playerId)
      if (player) {
        const stored = localStorage.getItem('whoami_room')
        if (stored) {
          try {
            const roomData = JSON.parse(stored)
            if (roomData.roomCode) {
              setRoomCode(roomData.roomCode)
              localStorage.setItem('whoami_room', JSON.stringify({
                ...roomData,
                playerId: data.playerId,
                isHost: data.isHost
              }))
            }
          } catch (e) {
            localStorage.removeItem('whoami_room')
          }
        }
      }
      if (data.gameState) {
        setGameState({
          ...data.gameState,
          serverStartTime: data.gameState.serverStartTime || Date.now()
        })
        if (typeof window !== 'undefined' && window.location.pathname !== '/game') {
          window.location.href = '/game'
        }
      } else if (typeof window !== 'undefined' && window.location.pathname !== '/lobby') {
        window.location.href = '/lobby'
      }
      setIsReconnecting(false)
      setError(null)
    }

    const handleKicked = (data: { nickname: string; banned: boolean }) => {
      const message = data.banned
        ? getErrorMessage('PLAYER_BANNED')
        : 'You have been removed from the room by the host.'
      setError(message)
      localStorage.removeItem('whoami_room')
      reset()
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }

    const handleRoundStarted = (data: any) => {
      const isFirstRound = data.roundNumber === 1
      const baseScoreboard =
        isFirstRound
          ? players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 }))
          : gameState?.currentScoreboard || players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 }))

      setGameState({
        phase: 'starting',
        roundNumber: data.roundNumber,
        cluesRevealed: [{ order: data.clue.order, text: data.clue.text }],
        isLocked: false,
        currentScoreboard: baseScoreboard,
        serverStartTime: data.serverStartTime
      })
      setError(null)
    }

    const handleClueRevealed = (data: { clue: { order: number; text: string } }) => {
      setGameState(prev => {
        if (!prev) return null
        const existingClue = prev.cluesRevealed.find(c => c.order === data.clue.order)
        if (existingClue) return prev
        return {
          ...prev,
          phase: 'clue_revealed',
          cluesRevealed: [...prev.cluesRevealed, data.clue]
        }
      })
    }

    const handlePlayerCorrect = (data: { nickname: string; position: number; timeElapsedMs: number }) => {
      const currentPlayer = players.find(p => p.id === playerId)
      if (currentPlayer && data.nickname === currentPlayer.nickname) {
        setGameState(prev => prev ? { ...prev, isLocked: true } : null)
      }
    }


    const handleRoundEnded = (data: any) => {
      setGameState(prev => prev ? {
        ...prev,
        phase: 'ended',
        currentScoreboard: data.scoreboard.map((sb: any) => ({
          playerId: sb.playerId,
          nickname: sb.nickname,
          score: sb.totalScore
        }))
      } : null)

      setTimeout(() => {
        setGameState(prev => prev ? {
          ...prev,
          phase: 'starting',
          isLocked: false,
          cluesRevealed: []
        } : null)
      }, 5000)
    }

    const handleGameEnded = (data: { finalScoreboard: Array<{ playerId: string; nickname: string; score: number }> }) => {
      setGameState({
        phase: 'ended',
        roundNumber: 0,
        cluesRevealed: [],
        isLocked: false,
        currentScoreboard: data.finalScoreboard
      })
    }

    const handleRoomError = (data: { code: string; message: string }) => {
      const userMessage = getErrorMessage(data.code, data.message)
      setError(userMessage)
      if (isFatalError(data.code)) {
        localStorage.removeItem('whoami_room')
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('ROOM_JOINED', handleRoomJoined)
    socket.on('PLAYER_JOINED', handlePlayerJoined)
    socket.on('PLAYER_LEFT', handlePlayerLeft)
    socket.on('PLAYER_RECONNECTED', handlePlayerReconnected)
    socket.on('SETTINGS_UPDATED', handleSettingsUpdated)
    socket.on('RECONNECT_SUCCESS', handleReconnectSuccess)
    socket.on('KICKED', handleKicked)
    socket.on('ROUND_STARTED', handleRoundStarted)
    socket.on('CLUE_REVEALED', handleClueRevealed)
    socket.on('PLAYER_CORRECT', handlePlayerCorrect)
    socket.on('ROUND_ENDED', handleRoundEnded)
    socket.on('GAME_ENDED', handleGameEnded)
    socket.on('ROOM_ERROR', handleRoomError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('ROOM_JOINED', handleRoomJoined)
      socket.off('PLAYER_JOINED', handlePlayerJoined)
      socket.off('PLAYER_LEFT', handlePlayerLeft)
      socket.off('PLAYER_RECONNECTED', handlePlayerReconnected)
      socket.off('SETTINGS_UPDATED', handleSettingsUpdated)
      socket.off('RECONNECT_SUCCESS', handleReconnectSuccess)
      socket.off('KICKED', handleKicked)
      socket.off('ROUND_STARTED', handleRoundStarted)
      socket.off('CLUE_REVEALED', handleClueRevealed)
      socket.off('PLAYER_CORRECT', handlePlayerCorrect)
      socket.off('ROUND_ENDED', handleRoundEnded)
      socket.off('GAME_ENDED', handleGameEnded)
      socket.off('ROOM_ERROR', handleRoomError)
    }
  }, [socket, playerId, players])

  const navigateToGame = () => {
    if (gameState) {
      window.location.href = '/game'
    }
  }

  const value: GameContextType = {
    roomCode,
    playerId,
    isHost,
    players,
    settings,
    gameState,
    error,
    isReconnecting,
    setRoomCode,
    setPlayerId,
    setIsHost,
    setPlayers,
    setSettings,
    setGameState,
    setError,
    setIsReconnecting,
    reset,
    navigateToGame
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
