import { Server } from 'socket.io'
import { getRoom, getRoomBySocket, createRoom } from '../rooms/store.js'
import {
  startGame,
  startNextRound,
  activateRound,
  revealClue,
  processGuess,
  endRound,
  endGame
} from '../game/roundState.js'

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

/**
 * Handle START_GAME event
 */
export async function handleStartGame(io, socket, payload) {
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

    if (room.status !== 'waiting') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Game is already in progress'
      })
      return
    }

    // Validate minimum players
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected)
    if (connectedPlayers.length < 2) {
      socket.emit('ROOM_ERROR', {
        code: 'INSUFFICIENT_PLAYERS',
        message: 'Need at least 2 players to start'
      })
      return
    }

    // Start the game
    await startGame(room)

    // Start first round (IDLE → STARTING)
    await startNextRound(room)

    // Broadcast ROUND_STARTED with clue 1
    const firstClue = room.currentRound.clues[0]
    io.to(room.code).emit('ROUND_STARTED', {
      roundNumber: room.currentRound.roundNumber,
      totalRounds: room.settings.totalRounds,
      serverStartTime: room.currentRound.serverStartTime,
      roundDuration: room.settings.roundDuration,
      clue: {
        order: firstClue.order,
        text: firstClue.text
      }
    })

    // Start 3s pre-guess countdown timer
    setTimeout(() => {
      // Transition to ACTIVE
      activateRound(room)

      // Set up round end timer
      const roundEndDelay = room.settings.roundDuration - 3000 // Already waited 3s
      room.currentRound.timers.roundEnd = setTimeout(() => {
        endRound(room)
        const roundResult = room.roundHistory[room.roundHistory.length - 1]
        broadcastRoundEnd(io, room, roundResult)
      }, roundEndDelay)
    }, 3000)

    // Set up clue reveal broadcast
    const clueRevealDelay = room.settings.clueRevealTime
    if (clueRevealDelay > 3000) {
      setTimeout(() => {
        if (room.currentRound && room.currentRound.phase !== 'ended') {
          revealClue(room)
          const secondClue = room.currentRound.clues[1]
          if (secondClue) {
            io.to(room.code).emit('CLUE_REVEALED', {
              clue: {
                order: secondClue.order,
                text: secondClue.text
              }
            })
          }
        }
      }, clueRevealDelay)
    }

  } catch (error) {
    console.error('Error in handleStartGame:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An error occurred'
    })
  }
}

/**
 * Handle SUBMIT_GUESS event
 */
export function handleSubmitGuess(io, socket, payload) {
  try {
    const { guess } = payload

    if (!guess || typeof guess !== 'string') {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Guess is required'
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

    // Process the guess
    const result = processGuess(room, socket.id, guess.trim())

    if (result === null) {
      // Invalid guess (rate limited, locked, etc.)
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
        // Rate limited or exceeded max guesses (handled by processGuess)
        socket.emit('ROOM_ERROR', {
          code: 'GUESS_RATE_LIMITED',
          message: 'Please wait before guessing again'
        })
      }
      return
    }

    // Broadcast guess (respect transparency mode)
    const broadcastPayload = room.settings.transparencyMode === 'full'
      ? { nickname: player.nickname, guess, correct: result.correct }
      : { nickname: player.nickname, correct: result.correct }

    io.to(room.code).emit('GUESS_BROADCAST', broadcastPayload)

    // If correct, broadcast PLAYER_CORRECT
    if (result.correct) {
      io.to(room.code).emit('PLAYER_CORRECT', {
        nickname: player.nickname,
        position: result.position,
        timeElapsedMs: result.timeElapsedMs
      })

      // Check if round ended early (all players locked)
      if (room.currentRound?.phase === 'ended') {
        // Round ended, broadcast ROUND_ENDED
        const roundResult = room.roundHistory[room.roundHistory.length - 1]
        broadcastRoundEnd(io, room, roundResult)
      }
    }

  } catch (error) {
    console.error('Error in handleSubmitGuess:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    })
  }
}

/**
 * Broadcast ROUND_ENDED event
 * @param {Server} io - Socket.io server
 * @param {Object} room - Room state
 * @param {Object} roundResult - Round result from roundHistory
 */
function broadcastRoundEnd(io, room, roundResult) {
  const payload = {
    answerRevealed: roundResult.answerRevealed,
    scoreboard: roundResult.scoreboard
  }

  if (roundResult.answerRevealed) {
    payload.answer = roundResult.entity.name
    payload.citations = roundResult.clues.map(c => c.citations).filter(Boolean)
  }

  io.to(room.code).emit('ROUND_ENDED', payload)

  // After 5s, move to next round or end game
  setTimeout(() => {
    if (room.status === 'in_progress') {
      // Start next round
      startNextRound(room).then(() => {
        if (room.status === 'finished') {
          // Game ended
          io.to(room.code).emit('GAME_ENDED', {
            finalScoreboard: room.finalScoreboard
          })
        } else {
          // Next round starting
          const firstClue = room.currentRound.clues[0]
          io.to(room.code).emit('ROUND_STARTED', {
            roundNumber: room.currentRound.roundNumber,
            totalRounds: room.settings.totalRounds,
            serverStartTime: room.currentRound.serverStartTime,
            roundDuration: room.settings.roundDuration,
            clue: {
              order: firstClue.order,
              text: firstClue.text
            }
          })

          // Start 3s pre-guess countdown
          setTimeout(() => {
            activateRound(room)

            // Set up round end timer
            const roundEndDelay = room.settings.roundDuration - 3000 // Already waited 3s
            room.currentRound.timers.roundEnd = setTimeout(() => {
              endRound(room)
              const roundResult = room.roundHistory[room.roundHistory.length - 1]
              broadcastRoundEnd(io, room, roundResult)
            }, roundEndDelay)
          }, 3000)

          // Set up clue reveal
          const clueRevealDelay = room.settings.clueRevealTime
          if (clueRevealDelay > 3000) {
            setTimeout(() => {
              if (room.currentRound && room.currentRound.phase !== 'ended') {
                revealClue(room)
                const secondClue = room.currentRound.clues[1]
                if (secondClue) {
                  io.to(room.code).emit('CLUE_REVEALED', {
                    clue: {
                      order: secondClue.order,
                      text: secondClue.text
                    }
                  })
                }
              }
            }, clueRevealDelay)
          }
        }
      }).catch(error => {
        console.error('Error starting next round:', error)
        io.to(room.code).emit('ROOM_ERROR', {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start next round'
        })
      })
    }
  }, 5000)
}
