import { createContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { GameHistoryEntry } from '../lib/gameHistory'
import { playSound } from '../lib/sounds'
import { getErrorMessage, isFatalError } from '../utils/errorMessages'

const RECONNECT_GRACE_MS = 5 * 60 * 1000

interface Player {
  id: string
  nickname: string
  avatarId?: string
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
  /** Dataset (content set) the room is scoped to; null until the host picks one. */
  datasetId: string | null
  /** Which entity types are drawn into rounds. Default: characters only. */
  entityType: 'character' | 'place' | 'all'
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
  gameHistory: GameHistoryEntry[]
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
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const reset = () => {
    setRoomCode(null)
    setPlayerId(null)
    setIsHost(false)
    setPlayers([])
    setSettings(null)
    setGameState(null)
    setGameHistory([])
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
      setError(null)
      // Re-join room when socket reconnects (e.g. after tab was backgrounded), so we don't stay disconnected
      attemptReconnect()
    }

    const handleConnectError = (err: unknown) => {
      // Socket.io retries automatically; the yellow "Connecting..." / "Reconnecting..."
      // banners cover transient failures. Avoid a sticky error toast on every attempt.
      console.warn('Socket connect_error:', err)
    }

    const handleReconnectFailed = () => {
      setIsReconnecting(false)
      setError(getErrorMessage('CONNECTION_FAILED'))
    }

    const handleDisconnect = () => {
      if (roomCode) {
        setIsReconnecting(true)

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
        }, RECONNECT_GRACE_MS)
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
      setGameHistory(Array.isArray(data.gameHistory) ? data.gameHistory : [])
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

    const handlePlayerJoined = (data: { id: string; nickname: string; avatarId?: string }) => {
      setPlayers(prev => [
        ...prev,
        { id: data.id, nickname: data.nickname, avatarId: data.avatarId, isHost: false, isConnected: true }
      ])
      playSound('player-join')
    }

    const handlePlayerLeft = (data: {
      id: string
      nickname: string
      newHost: string | null
      reason?: 'left' | 'kicked'
    }) => {
      setPlayers(prev => prev.filter(p => p.id !== data.id))
      if (data.newHost) {
        setPlayers(prev => prev.map(p => ({ ...p, isHost: p.nickname === data.newHost })))
      }
      if (data.reason === 'kicked') {
        playSound('player-kick')
      }
    }

    const handlePlayerReconnected = (data: {
      id: string
      nickname: string
      players?: Array<{ id: string; nickname: string; avatarId?: string; isHost: boolean; isConnected: boolean }>
    }) => {
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
      if (Array.isArray(data.gameHistory)) {
        setGameHistory(data.gameHistory)
      }
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
      playSound('player-kick')
      const message = data.banned
        ? getErrorMessage('PLAYER_BANNED')
        : 'You have been removed from the room by the host.'
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem('whoami_kick_message', message)
        } catch {
          // sessionStorage may be unavailable in private mode; safe to ignore
        }
      }
      localStorage.removeItem('whoami_room')
      reset()
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }

    const handleRoundStarted = (data: any) => {
      const baseScoreboard =
        data.currentScoreboard
          || gameState?.currentScoreboard
          || players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 }))

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
      if (data.clue.order > 1) {
        playSound('clue-pop')
      }
    }

    const handlePlayerCorrect = (data: { nickname: string; position: number; timeElapsedMs: number }) => {
      const currentPlayer = players.find(p => p.id === playerId)
      if (currentPlayer && data.nickname === currentPlayer.nickname) {
        setGameState(prev => prev ? { ...prev, isLocked: true } : null)
        playSound('correct')
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


      if (!data.answerRevealed) {
        playSound('uh-oh')
      }
    }

    const handleGameEnded = (data: {
      finalScoreboard: Array<{ playerId: string; nickname: string; score: number }>
      gameHistory?: GameHistoryEntry[]
    }) => {
      setGameState({
        phase: 'ended',
        roundNumber: 0,
        cluesRevealed: [],
        isLocked: false,
        currentScoreboard: data.finalScoreboard
      })
      if (Array.isArray(data.gameHistory)) {
        setGameHistory(data.gameHistory)
      }

      const topScore = Math.max(0, ...data.finalScoreboard.map((entry) => entry.score))
      if (topScore > 0) {
        const isWinner = data.finalScoreboard.some(
          (entry) => entry.playerId === playerId && entry.score === topScore
        )
        if (isWinner) playSound('yay')
      }
    }

    const handleRoomError = (data: { code: string; message: string }) => {
      const userMessage = getErrorMessage(data.code, data.message)
      setError(userMessage)
      setIsReconnecting(false)
      if (isFatalError(data.code)) {
        localStorage.removeItem('whoami_room')
        // Drop dead room state so Home/Lobby aren't stuck "reconnecting",
        // but keep the error visible until the user dismisses or retries.
        setRoomCode(null)
        setPlayerId(null)
        setIsHost(false)
        setPlayers([])
        setSettings(null)
        setGameState(null)
        setGameHistory([])
      }
    }

    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('reconnect_failed', handleReconnectFailed)
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
      socket.off('connect_error', handleConnectError)
      socket.off('reconnect_failed', handleReconnectFailed)
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
  }, [socket, playerId, players, gameState, roomCode])

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
    gameHistory,
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
