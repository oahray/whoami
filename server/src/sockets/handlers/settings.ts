import { Server, Socket } from 'socket.io'
import { getRoomBySocket } from '../../rooms/store.js'
import { resetRoomForNewGame } from '../../game/roundState.js'
import { getDataset } from '../../db/entities.js'
import {
  encodeDifficultySelection,
  parseDifficultySelection
} from '../../game/difficultySelection.js'
import { logger } from '../../utils/logger.js'

export async function handleUpdateSettings(io: Server, socket: Socket, payload: any) {
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

    if (room.status === 'finished') {
      resetRoomForNewGame(room)
    }

    if (room.status !== 'waiting') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Cannot update settings during game'
      })
      return
    }

    const {
      roundDuration,
      clueRevealTime,
      totalRounds,
      difficultyMode,
      strictMode,
      transparencyMode,
      maxGuessesPerRound,
      datasetId,
      entityType
    } = payload

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
      if (clueRevealTime < 2000 || clueRevealTime > room.settings.roundDuration - 1500) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Clue reveal time must be at least 2s and at most ~1.5s less than the round duration'
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
      const selection = parseDifficultySelection(difficultyMode)
      if (selection === null) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Invalid difficulty mode'
        })
        return
      }
      room.settings.difficultyMode = encodeDifficultySelection(selection)
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

    if (entityType !== undefined) {
      if (!['character', 'place', 'all'].includes(entityType)) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Invalid entity type'
        })
        return
      }
      room.settings.entityType = entityType
    }

    if (datasetId !== undefined) {
      if (datasetId !== null && (typeof datasetId !== 'string' || datasetId.trim() === '')) {
        socket.emit('ROOM_ERROR', {
          code: 'INVALID_SETTINGS',
          message: 'Invalid dataset id'
        })
        return
      }

      if (datasetId === null) {
        room.settings.datasetId = null
      } else {
        const dataset = await getDataset(datasetId)
        if (!dataset) {
          socket.emit('ROOM_ERROR', {
            code: 'INVALID_SETTINGS',
            message: 'Selected dataset does not exist'
          })
          return
        }
        if (!dataset.is_enabled) {
          socket.emit('ROOM_ERROR', {
            code: 'DATASET_DISABLED',
            message: 'Selected dataset is disabled'
          })
          return
        }
        room.settings.datasetId = dataset.id
      }
    }

    io.to(room.code).emit('SETTINGS_UPDATED', room.settings)
  } catch (error: any) {
    const room = getRoomBySocket(socket.id)
    logger.error('Error in handleUpdateSettings', error, {
      socketId: socket.id,
      roomCode: room?.code
    })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while updating settings'
    })
  }
}
