import { Server, Socket } from 'socket.io'
import { getRoom, getRoomBySocket, createRoom, deleteRoom } from '../../rooms/store.js'
import { findReturningPlayer, transferHost, buildReconnectPayload, GRACE_PERIOD_MS } from './utils.js'

export function handleJoinRoom(io: Server, socket: Socket, payload: any) {
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

    if (room.status !== 'waiting') {
      socket.emit('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Cannot join game in progress'
      })
      return
    }

    for (const player of room.players.values()) {
      if (player.nickname.toLowerCase() === nickname.toLowerCase() && player.isConnected) {
        socket.emit('ROOM_ERROR', {
          code: 'NICKNAME_TAKEN',
          message: 'Nickname already taken'
        })
        return
      }
    }

    if (room.players.size >= 5) {
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
    console.error(`Error in handleJoinRoom for socket ${socket.id}, roomCode: ${payload?.roomCode || 'unknown'}:`, error)
    socket.emit('ROOM_ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while joining the room'
    })
  }
}

export function handleCreateRoom(io: Server, socket: Socket, payload: any) {
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
    console.error(`Error in handleCreateRoom for socket ${socket.id}, nickname: ${payload?.nickname || 'unknown'}:`, error)
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
    console.error(`Error in handleLeaveRoom for socket ${socket.id}:`, error)
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
    }, GRACE_PERIOD_MS)

    if (room.status === 'in_progress') {
      socket.to(room.code).emit('PLAYER_DISCONNECTED', {
        id: socket.id,
        nickname: player.nickname
      })
    }
  } catch (error: any) {
    console.error(`Error in handleDisconnect for socket ${socket.id}:`, error)
  }
}
