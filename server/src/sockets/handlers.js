import { Server } from 'socket.io'
import { getRoom, getRoomBySocket, createRoom } from '../rooms/store.js'
import { isRateLimited, hasExceededMaxGuesses } from '../game/rateLimit.js'
import { validateGuess } from '../game/validation.js'
import { calculateScore } from '../game/scoring.js'

const GRACE_PERIOD_MS = 30000 // 30 seconds

/**
 * Find a returning player within grace period
 * @param {Object} room - Room state
 * @param {string} nickname - Player nickname
 * @returns {Object|null} Player object or null
 */
function findReturningPlayer(room, nickname) {
  for (const player of room.players.values()) {
    if (player.nickname === nickname && player.disconnectedAt) {
      const timeSinceDisconnect = Date.now() - player.disconnectedAt
      if (timeSinceDisconnect < GRACE_PERIOD_MS) {
        return player
      }
    }
  }
  return null
}

/**
 * Check if all players are locked
 * @param {Object} room - Room state
 * @returns {boolean} True if all players are locked
 */
function allPlayersLocked(room) {
  for (const player of room.players.values()) {
    if (player.isConnected && !player.isLocked) {
      return false
    }
  }
  return true
}

/**
 * Transfer host to next available player
 * @param {Object} room - Room state
 * @returns {string|null} New host ID or null
 */
function transferHost(room) {
  // Find first connected player who isn't the current host
  const oldHostId = room.hostId
  for (const [playerId, player] of room.players.entries()) {
    if (player.isConnected && playerId !== oldHostId) {
      // Remove host flag from old host
      const oldHost = room.players.get(oldHostId)
      if (oldHost) {
        oldHost.isHost = false
      }
      // Set new host
      room.hostId = playerId
      player.isHost = true
      return playerId
    }
  }
  return null
}

/**
 * Build reconnect payload with full game state
 * @param {Object} room - Room state
 * @param {Object} player - Player object
 * @returns {Object} Reconnect payload
 */
function buildReconnectPayload(room, player) {
  const payload = {
    playerId: player.id,
    isHost: player.isHost,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      isConnected: p.isConnected
    })),
    settings: room.settings
  }

  // If game is in progress, include game state
  if (room.status === 'in_progress' && room.currentRound) {
    payload.gameState = {
      phase: room.currentRound.phase,
      roundNumber: room.currentRound.roundNumber,
      cluesRevealed: room.currentRound.clues.map(c => ({
        order: c.order,
        text: c.text
      })),
      isLocked: player.isLocked,
      currentScoreboard: Array.from(room.scores.entries()).map(([id, score]) => {
        const p = room.players.get(id)
        return {
          playerId: id,
          nickname: p?.nickname || 'Unknown',
          score
        }
      }).sort((a, b) => b.score - a.score)
    }
  }

  return payload
}

/**
 * Handle JOIN_ROOM event
 */
export function handleJoinRoom(io, socket, payload) {
  try {
    const { roomCode, nickname } = payload

    if (!roomCode || !nickname) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Room code and nickname are required'
      })
      return
    }

    const room = getRoom(roomCode)
    if (!room) {
      socket.emit('ROOM_ERROR', {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found'
      })
      return
    }

    // Check for returning player within grace period
    const returning = findReturningPlayer(room, nickname)
    if (returning && room.status === 'in_progress') {
      // Reattach socket to existing player slot
      returning.id = socket.id
      returning.isConnected = true
      returning.disconnectedAt = null
      room.players.delete(returning.id) // Remove old socket ID
      room.players.set(socket.id, returning)

      socket.join(roomCode)
      socket.emit('RECONNECT_SUCCESS', buildReconnectPayload(room, returning))
      socket.to(roomCode).emit('PLAYER_RECONNECTED', { nickname })
      return
    }

    // New player join - only allowed in waiting status
    if (room.status !== 'waiting') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Cannot join game in progress'
      })
      return
    }

    // Check nickname uniqueness
    for (const player of room.players.values()) {
      if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
        socket.emit('ROOM_ERROR', {
          code: 'NICKNAME_TAKEN',
          message: 'Nickname already taken'
        })
        return
      }
    }

    // Check room capacity (max 5 players)
    if (room.players.size >= 5) {
      socket.emit('ROOM_ERROR', {
        code: 'ROOM_FULL',
        message: 'Room is full'
      })
      return
    }

    // Add new player
    const player = {
      id: socket.id,
      nickname,
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    }

    room.players.set(socket.id, player)
    socket.join(roomCode)

    // Send ROOM_JOINED to new player
    socket.emit('ROOM_JOINED', {
      playerId: socket.id,
      isHost: false,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isConnected: p.isConnected
      })),
      settings: room.settings
    })

    // Broadcast PLAYER_JOINED to others
    socket.to(roomCode).emit('PLAYER_JOINED', {
      id: socket.id,
      nickname
    })
  } catch (error) {
    console.error('Error in handleJoinRoom:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    })
  }
}

/**
 * Handle room creation (host)
 */
export function handleCreateRoom(io, socket, payload) {
  try {
    const { nickname } = payload

    if (!nickname) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Nickname is required'
      })
      return
    }

    const room = createRoom(socket.id, nickname)
    socket.join(room.code)

    socket.emit('ROOM_JOINED', {
      playerId: socket.id,
      isHost: true,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isConnected: p.isConnected
      })),
      settings: room.settings,
      roomCode: room.code
    })
  } catch (error) {
    console.error('Error in handleCreateRoom:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    })
  }
}

/**
 * Handle LEAVE_ROOM event
 */
export function handleLeaveRoom(io, socket) {
  try {
    const room = getRoomBySocket(socket.id)
    if (!room) return

    const player = room.players.get(socket.id)
    if (!player) return

    const wasHost = player.isHost
    const nickname = player.nickname

    // Remove player
    room.players.delete(socket.id)
    socket.leave(room.code)

    // If host left, transfer host
    let newHostId = null
    if (wasHost) {
      newHostId = transferHost(room)
    }

    // If no players left, delete room
    if (room.players.size === 0) {
      deleteRoom(room.code)
      return
    }

    // Broadcast PLAYER_LEFT
    io.to(room.code).emit('PLAYER_LEFT', {
      id: socket.id,
      nickname,
      newHost: newHostId ? room.players.get(newHostId)?.nickname : null
    })
  } catch (error) {
    console.error('Error in handleLeaveRoom:', error)
  }
}

/**
 * Handle disconnect
 */
export function handleDisconnect(io, socket) {
  try {
    const room = getRoomBySocket(socket.id)
    if (!room) return

    const player = room.players.get(socket.id)
    if (!player) return

    // Mark as disconnected but keep in room for grace period
    player.isConnected = false
    player.disconnectedAt = Date.now()

    // Start grace period timer
    setTimeout(() => {
      const roomAfterDelay = getRoomBySocket(socket.id)
      if (!roomAfterDelay) return

      const playerAfterDelay = roomAfterDelay.players.get(socket.id)
      if (!playerAfterDelay || playerAfterDelay.isConnected) return

      // Grace period expired - remove player
      const nickname = playerAfterDelay.nickname
      const wasHost = playerAfterDelay.isHost

      roomAfterDelay.players.delete(socket.id)

      // If host disconnected, transfer host
      let newHostId = null
      if (wasHost) {
        newHostId = transferHost(roomAfterDelay)
      }

      // If no players left, delete room
      if (roomAfterDelay.players.size === 0) {
        deleteRoom(roomAfterDelay.code)
        return
      }

      // Broadcast PLAYER_LEFT
      io.to(roomAfterDelay.code).emit('PLAYER_LEFT', {
        id: socket.id,
        nickname,
        newHost: newHostId ? roomAfterDelay.players.get(newHostId)?.nickname : null
      })
    }, GRACE_PERIOD_MS)

    // If game is in progress, broadcast disconnect
    if (room.status === 'in_progress') {
      socket.to(room.code).emit('PLAYER_DISCONNECTED', {
        id: socket.id,
        nickname: player.nickname
      })
    }
  } catch (error) {
    console.error('Error in handleDisconnect:', error)
  }
}

/**
 * Handle UPDATE_SETTINGS event
 */
export function handleUpdateSettings(io, socket, payload) {
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

    // Validate and update settings
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

    // Broadcast updated settings
    io.to(room.code).emit('SETTINGS_UPDATED', room.settings)
  } catch (error) {
    console.error('Error in handleUpdateSettings:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    })
  }
}
