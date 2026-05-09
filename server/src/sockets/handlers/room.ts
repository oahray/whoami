import { Server, Socket } from 'socket.io'
import { getRoom, getRoomBySocket, createRoom, deleteRoom } from '../../rooms/store.js'
import { findReturningPlayer, transferHost, buildReconnectPayload, GRACE_PERIOD_MS } from './utils.js'
import { safeTimer } from '../dispatch.js'
import { logger } from '../../utils/logger.js'

function migratePlayerReferences(room: any, oldPlayerId: string, newPlayerId: string) {
  if (oldPlayerId === newPlayerId) {
    return
  }

  if (room.hostId === oldPlayerId) {
    room.hostId = newPlayerId
  }

  if (room.scores.has(oldPlayerId)) {
    const score = room.scores.get(oldPlayerId) ?? 0
    room.scores.delete(oldPlayerId)
    room.scores.set(newPlayerId, score)
  }

  if (room.currentRound) {
    room.currentRound.correctGuesses = room.currentRound.correctGuesses.map((guess: any) =>
      guess.playerId === oldPlayerId ? { ...guess, playerId: newPlayerId } : guess
    )
  }

  room.roundHistory = room.roundHistory.map((round: any) => ({
    ...round,
    correctGuesses: Array.isArray(round.correctGuesses)
      ? round.correctGuesses.map((guess: any) =>
        guess.playerId === oldPlayerId ? { ...guess, playerId: newPlayerId } : guess
      )
      : round.correctGuesses,
    scoreboard: Array.isArray(round.scoreboard)
      ? round.scoreboard.map((entry: any) =>
        entry.playerId === oldPlayerId ? { ...entry, playerId: newPlayerId } : entry
      )
      : round.scoreboard
  }))

  if (room.finalScoreboard) {
    room.finalScoreboard = room.finalScoreboard.map((entry: any) =>
      entry.playerId === oldPlayerId ? { ...entry, playerId: newPlayerId } : entry
    )
  }
}

export function handleJoinRoom(_io: Server, socket: Socket, payload: any) {
  try {
    if (!payload || typeof payload !== 'object') {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid request format'
      })
      return
    }

    const { roomCode, nickname } = payload

    if (!roomCode || typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Room code is required'
      })
      return
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Nickname is required'
      })
      return
    }

    if (nickname.length > 20) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Nickname is too long (maximum 20 characters)'
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

    // Check if player has been kicked too many times (banned from this room)
    const kickCount = room.kickedPlayers.get(nickname.toLowerCase()) || 0
    if (kickCount >= 2) {
      socket.emit('ROOM_ERROR', {
        code: 'PLAYER_BANNED',
        message: 'You have been removed from this room and cannot rejoin'
      })
      return
    }

    const returning = findReturningPlayer(room, nickname)
    if (returning) {
      let oldPlayerId: string | null = null
      for (const [playerId, player] of room.players.entries()) {
        if (player === returning) {
          oldPlayerId = playerId
          break
        }
      }

      if (oldPlayerId) {
        returning.id = socket.id
        returning.isConnected = true
        returning.disconnectedAt = null
        migratePlayerReferences(room, oldPlayerId, socket.id)
        room.players.delete(oldPlayerId)
        room.players.set(socket.id, returning)

        socket.join(roomCode)

        if (room.status === 'in_progress') {
          socket.emit('RECONNECT_SUCCESS', buildReconnectPayload(room, returning))
        } else {
          socket.emit('ROOM_JOINED', {
            playerId: socket.id,
            isHost: returning.isHost,
            players: Array.from(room.players.values()).map(p => ({
              id: p.id,
              nickname: p.nickname,
              isHost: p.isHost,
              isConnected: p.isConnected
            })),
            settings: room.settings,
            roomCode: room.code
          })
        }

        socket.to(roomCode).emit('PLAYER_RECONNECTED', {
          id: socket.id,
          nickname,
          players: Array.from(room.players.values()).map(p => ({
            id: p.id,
            nickname: p.nickname,
            isHost: p.isHost,
            isConnected: p.isConnected
          }))
        })
        return
      }
    }

    if (room.status === 'in_progress') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Cannot join game in progress'
      })
      return
    }

    // Only reclaim an existing seat when that player is no longer connected.
    const existingEntry = Array.from(room.players.entries()).find(
      ([, p]) => p.nickname.toLowerCase() === nickname.toLowerCase()
    )
    if (existingEntry) {
      const [oldPlayerId, existingPlayer] = existingEntry

      if (existingPlayer.isConnected) {
        socket.emit('ROOM_ERROR', {
          code: 'NICKNAME_TAKEN',
          message: 'Nickname already taken'
        })
        return
      }

      existingPlayer.id = socket.id
      existingPlayer.isConnected = true
      existingPlayer.disconnectedAt = null
      migratePlayerReferences(room, oldPlayerId, socket.id)

      room.players.delete(oldPlayerId)
      room.players.set(socket.id, existingPlayer)

      socket.join(roomCode)

      socket.emit('ROOM_JOINED', {
        playerId: socket.id,
        isHost: existingPlayer.isHost,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
          isConnected: p.isConnected
        })),
        settings: room.settings,
        roomCode: room.code
      })

      socket.to(roomCode).emit('PLAYER_RECONNECTED', {
        id: socket.id,
        nickname,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
          isConnected: p.isConnected
        }))
      })
      return
    }

    if (room.players.size >= 10) {
      socket.emit('ROOM_ERROR', {
        code: 'ROOM_FULL',
        message: 'Room is full'
      })
      return
    }

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

    socket.to(roomCode).emit('PLAYER_JOINED', {
      id: socket.id,
      nickname
    })
  } catch (error: any) {
    logger.error('Error in handleJoinRoom', error, {
      socketId: socket.id,
      roomCode: payload?.roomCode
    })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while joining the room'
    })
  }
}

export function handleCreateRoom(_io: Server, socket: Socket, payload: any) {
  try {
    if (!payload || typeof payload !== 'object') {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid request format'
      })
      return
    }

    const { nickname } = payload

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Nickname is required'
      })
      return
    }

    if (nickname.length > 20) {
      socket.emit('ROOM_ERROR', {
        code: 'INVALID_PAYLOAD',
        message: 'Nickname is too long (maximum 20 characters)'
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
  } catch (error: any) {
    logger.error('Error in handleCreateRoom', error, {
      socketId: socket.id,
      nickname: payload?.nickname
    })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while creating the room'
    })
  }
}

export function handleLeaveRoom(io: Server, socket: Socket) {
  try {
    const room = getRoomBySocket(socket.id)
    if (!room) return

    const player = room.players.get(socket.id)
    if (!player) return

    const wasHost = player.isHost
    const nickname = player.nickname

    room.players.delete(socket.id)
    socket.leave(room.code)

    let newHostId = null
    if (wasHost) {
      newHostId = transferHost(room)
    }

    if (room.players.size === 0) {
      deleteRoom(room.code)
      return
    }

    io.to(room.code).emit('PLAYER_LEFT', {
      id: socket.id,
      nickname,
      newHost: newHostId ? room.players.get(newHostId)?.nickname : null
    })
  } catch (error: any) {
    logger.error('Error in handleLeaveRoom', error, { socketId: socket.id })
  }
}

export function handleKickPlayer(io: Server, socket: Socket, payload: any) {
  try {
    if (!payload || typeof payload !== 'object' || !payload.playerId) {
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

    const requester = room.players.get(socket.id)
    if (!requester || !requester.isHost) {
      socket.emit('ROOM_ERROR', {
        code: 'NOT_HOST',
        message: 'Only the host can kick players'
      })
      return
    }

    const target = room.players.get(payload.playerId)
    if (!target || target.isHost) {
      return
    }

    const nickname = target.nickname

    // Update kick count for this nickname (case-insensitive)
    const key = nickname.toLowerCase()
    const currentCount = room.kickedPlayers.get(key) || 0
    const newCount = currentCount + 1
    room.kickedPlayers.set(key, newCount)

    room.players.delete(payload.playerId)

    // Notify the kicked player
    io.to(payload.playerId).emit('KICKED', {
      nickname,
      banned: newCount >= 2
    })

    // Notify remaining players
    io.to(room.code).emit('PLAYER_LEFT', {
      id: payload.playerId,
      nickname,
      newHost: null
    })
  } catch (error: any) {
    logger.error('Error in handleKickPlayer', error, { socketId: socket.id })
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while kicking the player'
    })
  }
}

export function handleDisconnect(io: Server, socket: Socket) {
  try {
    const room = getRoomBySocket(socket.id)
    if (!room) return

    const player = room.players.get(socket.id)
    if (!player) return

    player.isConnected = false
    player.disconnectedAt = Date.now()

    setTimeout(() => {
      safeTimer('handleDisconnect:gracePeriod', () => {
        const roomAfterDelay = getRoomBySocket(socket.id)
        if (!roomAfterDelay) return

        const playerAfterDelay = roomAfterDelay.players.get(socket.id)
        if (!playerAfterDelay || playerAfterDelay.isConnected) return

        const nickname = playerAfterDelay.nickname
        const wasHost = playerAfterDelay.isHost

        roomAfterDelay.players.delete(socket.id)

        let newHostId = null
        if (wasHost) {
          newHostId = transferHost(roomAfterDelay)
        }

        if (roomAfterDelay.players.size === 0) {
          deleteRoom(roomAfterDelay.code)
          return
        }

        io.to(roomAfterDelay.code).emit('PLAYER_LEFT', {
          id: socket.id,
          nickname,
          newHost: newHostId ? roomAfterDelay.players.get(newHostId)?.nickname : null
        })
      })
    }, GRACE_PERIOD_MS)

    if (room.status === 'in_progress') {
      socket.to(room.code).emit('PLAYER_DISCONNECTED', {
        id: socket.id,
        nickname: player.nickname
      })
    }
  } catch (error: any) {
    logger.error('Error in handleDisconnect', error, { socketId: socket.id })
  }
}
