import { Server, Socket } from 'socket.io'
import { getRoomBySocket } from '../../rooms/store.js'
import { startGame, startNextRound, activateRound, revealClue, processGuess, endRound, resetRoomForNewGame } from '../../game/roundState'
import { broadcastRoundEnd } from './utils.js'

export async function handleStartGame(io: Server, socket: Socket, payload: any) {
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

    await startGame(room)
    await startNextRound(room)

    const firstClue = room.currentRound!.clues[0]
    io.to(room.code).emit('ROUND_STARTED', {
      roundNumber: room.currentRound!.roundNumber,
      totalRounds: room.settings.totalRounds,
      serverStartTime: room.currentRound!.serverStartTime,
      roundDuration: room.settings.roundDuration,
      clue: {
        order: firstClue.order,
        text: firstClue.text
      }
    })

    setTimeout(() => {
      activateRound(room)
      const roundEndDelay = room.settings.roundDuration - 3000
      room.currentRound!.timers.roundEnd = setTimeout(() => {
        endRound(room)
        const roundResult = room.roundHistory[room.roundHistory.length - 1]
        broadcastRoundEnd(io, room, roundResult)
      }, roundEndDelay)
    }, 3000)

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
  } catch (error: any) {
    console.error('Error in handleStartGame:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An error occurred'
    })
  }
}

export function handleSubmitGuess(io: Server, socket: Socket, payload: any) {
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

    const result = processGuess(room, socket.id, guess.trim())

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
      ? { nickname: player.nickname, guess, correct: result.correct }
      : { nickname: player.nickname, correct: result.correct }

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
  } catch (error) {
    console.error('Error in handleSubmitGuess:', error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    })
  }
}
