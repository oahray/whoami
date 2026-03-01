import { Server, Socket } from 'socket.io'
import { getRoomBySocket } from '../../rooms/store.js'

export function handleUpdateSettings(io: Server, socket: Socket, payload: any) {
  try {
    if (!payload || typeof payload !== 'object') {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid request format'
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
    if (!player || !player.isHost) {
      socket.emit('ROOM_ERROR', {
        code: 'NOT_HOST',
        message: 'Only the host can update settings'
      })
      return
    }

    if (room.status !== 'waiting') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Cannot update settings during game'
      })
      return
    }

    const { roundDuration, clueRevealTime, totalRounds, difficultyMode, strictMode, transparencyMode, maxGuessesPerRound } = payload

    if (roundDuration !== undefined) {
      if (roundDuration < 10000 || roundDuration > 60000) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Round duration must be between 10s and 60s'
        })
        return
      }
      room.settings.roundDuration = roundDuration
    }

    if (clueRevealTime !== undefined) {
      if (clueRevealTime < 0 || clueRevealTime >= room.settings.roundDuration) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Clue reveal time must be less than round duration'
        })
        return
      }
      room.settings.clueRevealTime = clueRevealTime
    }

    if (totalRounds !== undefined) {
      if (totalRounds < 3 || totalRounds > 10) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Total rounds must be between 3 and 10'
        })
        return
      }
      room.settings.totalRounds = totalRounds
    }

    if (difficultyMode !== undefined) {
      if (!['easy', 'medium', 'hard', 'nightmare'].includes(difficultyMode)) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Invalid difficulty mode'
        })
        return
      }
      room.settings.difficultyMode = difficultyMode
    }

    if (strictMode !== undefined) {
      room.settings.strictMode = strictMode
    }

    if (transparencyMode !== undefined) {
      if (!['full', 'minimal'].includes(transparencyMode)) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Invalid transparency mode'
        })
        return
      }
      room.settings.transparencyMode = transparencyMode
    }

    if (maxGuessesPerRound !== undefined) {
      if (maxGuessesPerRound < 1 || maxGuessesPerRound > 50) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Max guesses per round must be between 1 and 50'
        })
        return
      }
      room.settings.maxGuessesPerRound = maxGuessesPerRound
    }

    io.to(room.code).emit('SETTINGS_UPDATED', room.settings)
  } catch (error: any) {
    const room = getRoomBySocket(socket.id)
    console.error(`Error in handleUpdateSettings for socket ${socket.id}, room: ${room?.code || 'unknown'}:`, error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while updating settings'
    })
  }
}
