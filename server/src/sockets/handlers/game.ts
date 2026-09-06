import { Server, Socket } from 'socket.io'
import { getRoomBySocket } from '../../rooms/store.js'
import {
  startGame,
  processGuess,
  resetRoomForNewGame,
  GameStartError
} from '../../game/roundState.js'
import {
  broadcastRoundEnd,
  emitRoundStarted,
  scheduleRoundActivation
} from './utils.js'
import { getMaintenanceBlock } from '../../db/maintenance.js'
import { logger } from '../../utils/logger.js'

export async function handleStartGame(io: Server, socket: Socket, _payload: any) {
  try {
    const room = getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('ROOM_ERROR', {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found'
      })
      return
    }

    const player = room.players.get(socket.id)
    if (!player || !player.isHost) {
      socket.emit('ROOM_ERROR', {
        code: 'NOT_HOST',
        message: 'Only the host can start the game'
      })
      return
    }

    if (room.status === 'in_progress') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Game is already in progress'
      })
      return
    }

    if (room.status === 'finished') {
      resetRoomForNewGame(room)
    }

    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected)
    if (connectedPlayers.length < 2) {
      socket.emit('ROOM_ERROR', {
        code: 'INSUFFICIENT_PLAYERS',
        message: 'Need at least 2 players to start'
      })
      return
    }

    const maintenance = await getMaintenanceBlock()
    if (maintenance) {
      socket.emit('ROOM_ERROR', {
        code: maintenance.code,
        message: maintenance.message,
        maintenanceEndsAt: maintenance.endsAt
      })
      return
    }

    try {
      await startGame(room)
    } catch (error) {
      if (error instanceof GameStartError) {
        socket.emit('ROOM_ERROR', {
          code: error.code,
          message: error.message
        })
        return
      }
      throw error
    }

    emitRoundStarted(io, room)
    scheduleRoundActivation(io, room)
  } catch (error: any) {
    const room = getRoomBySocket(socket.id)
    logger.error('Error in handleStartGame', error, {
      socketId: socket.id,
      roomCode: room?.code
    })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while starting the game'
    })
  }
}

export function handleSubmitGuess(io: Server, socket: Socket, payload: any) {
  try {
    if (!payload || typeof payload !== 'object') {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid request format'
      })
      return
    }

    const guessValue = payload.guess

    if (!guessValue || typeof guessValue !== 'string' || guessValue.trim().length === 0) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Guess is required and must be a non-empty string'
      })
      return
    }

    if (guessValue.length > 100) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Guess is too long (maximum 100 characters)'
      })
      return
    }

    const room = getRoomBySocket(socket.id)
    if (!room) {
      socket.emit('ROOM_ERROR', {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found'
      })
      return
    }

    const player = room.players.get(socket.id)
    if (!player) {
      socket.emit('ROOM_ERROR', {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found'
      })
      return
    }

    const result = processGuess(room, socket.id, guessValue.trim())

    if (result === null) {
      if (room.currentRound?.phase === 'starting' || room.currentRound?.phase === 'ended') {
        socket.emit('ROOM_ERROR', {
          code: 'GUESSING_NOT_OPEN',
          message: 'Guessing is not open'
        })
      } else if (player.isLocked) {
        socket.emit('ROOM_ERROR', {
          code: 'PLAYER_LOCKED',
          message: 'You have already guessed correctly this round'
        })
      } else {
        socket.emit('ROOM_ERROR', {
          code: 'GUESS_RATE_LIMITED',
          message: 'Please wait before guessing again'
        })
      }
      return
    }

    const broadcastPayload = room.settings.transparencyMode === 'full'
      ? { nickname: player.nickname, avatarId: player.avatarId, guess: guessValue, correct: result.correct }
      : { nickname: player.nickname, avatarId: player.avatarId, correct: result.correct }

    io.to(room.code).emit('GUESS_BROADCAST', broadcastPayload)

    if (result.correct) {
      io.to(room.code).emit('PLAYER_CORRECT', {
        nickname: player.nickname,
        position: result.position,
        timeElapsedMs: result.timeElapsedMs
      })

      if (room.currentRound?.phase === 'ended') {
        const roundResult = room.roundHistory[room.roundHistory.length - 1]
        broadcastRoundEnd(io, room, roundResult)
      }
    }
  } catch (error: any) {
    const room = getRoomBySocket(socket.id)
    logger.error('Error in handleSubmitGuess', error, {
      socketId: socket.id,
      roomCode: room?.code,
      guessPreview: typeof payload?.guess === 'string' ? payload.guess.substring(0, 20) : undefined
    })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while processing your guess'
    })
  }
}
