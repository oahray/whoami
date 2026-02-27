import { Server } from 'socket.io'
import type { RoomState, Player } from '../../rooms/store.js'
import { startNextRound, activateRound, revealClue, endRound } from '../../game/roundState.js'
import { deleteRoom } from '../../rooms/store.js'

const GRACE_PERIOD_MS = 30000

export function findReturningPlayer(room: RoomState, nickname: string): Player | null {
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

export function transferHost(room: RoomState): string | null {
  const oldHostId = room.hostId
  for (const [playerId, player] of room.players.entries()) {
    if (player.isConnected && playerId !== oldHostId) {
      const oldHost = room.players.get(oldHostId)
      if (oldHost) {
        oldHost.isHost = false
      }
      room.hostId = playerId
      player.isHost = true
      return playerId
    }
  }
  return null
}

export function buildReconnectPayload(room: RoomState, player: Player) {
  const payload: any = {
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

export function broadcastRoundEnd(io: Server, room: RoomState, roundResult: any) {
  const payload: any = {
    answerRevealed: roundResult.answerRevealed,
    scoreboard: roundResult.scoreboard
  }

  if (roundResult.answerRevealed) {
    payload.answer = roundResult.entity.name
    payload.citations = roundResult.clues.map((c: any) => c.citations).filter(Boolean)
  }

  io.to(room.code).emit('ROUND_ENDED', payload)

  setTimeout(() => {
    if (room.status === 'in_progress') {
      startNextRound(room).then(() => {
        if (room.status === 'finished') {
          io.to(room.code).emit('GAME_ENDED', {
            finalScoreboard: room.finalScoreboard
          })
        } else {
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

export { GRACE_PERIOD_MS }
