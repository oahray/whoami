import { Server } from 'socket.io'
import type { RoomState, Player } from '../../rooms/store.js'
import { startNextRound, activateRound, endRound, revealClue } from '../../game/roundState'
import { ROUND_START_DELAY_MS } from '../../game/config.js'
import { safeTimer } from '../dispatch.js'
import { logger } from '../../utils/logger.js'

/**
 * Minimum reveal interval. We don't reveal clues less than this far apart even
 * if the host picks `clueRevealTime = 0`, otherwise the round just dumps all
 * clues at once which defeats the point of a guessing game.
 */
const MIN_CLUE_INTERVAL_MS = 2000
/**
 * Don't reveal a new clue when fewer than this many ms remain in the round.
 * Players need a moment to read the clue before the round ends.
 */
const CLUE_TAIL_BUFFER_MS = 1500

/**
 * Schedule the timed reveal of every clue past the first. Intervals are
 * measured from the moment the round became `active` (after the pre-round
 * countdown), so a `clueRevealTime` of 5s puts the 2nd clue at activation+5s
 * regardless of how long the countdown was. Each reveal:
 *   1. advances `currentRound.revealedClueCount` (via `revealClue`)
 *   2. emits CLUE_REVEALED to the room
 *   3. recurses to schedule the next reveal, if any.
 *
 * No-op if there is only one clue, the interval is unusable, or the round has
 * already ended by the time the timer fires.
 */
export function scheduleClueReveals(io: Server, room: RoomState): void {
  const round = room.currentRound
  if (!round) return
  if (round.clues.length <= 1) return

  const rawInterval = room.settings.clueRevealTime
  if (!Number.isFinite(rawInterval) || rawInterval < MIN_CLUE_INTERVAL_MS) return

  const interval = Math.max(MIN_CLUE_INTERVAL_MS, rawInterval)
  const roundDuration = room.settings.roundDuration
  const referenceStart = round.activeStartTime ?? Date.now()

  function scheduleNext(): void {
    const current = room.currentRound
    if (!current) return
    if (current.phase === 'ended') return
    if (current.revealedClueCount >= current.clues.length) return

    const elapsedAtNext = current.revealedClueCount * interval
    if (elapsedAtNext > roundDuration - CLUE_TAIL_BUFFER_MS) return

    const elapsedNow = Date.now() - referenceStart
    const delay = Math.max(0, elapsedAtNext - elapsedNow)

    current.timers.clueReveal = setTimeout(() => {
      safeTimer('scheduleClueReveals:fire', () => {
        const round2 = room.currentRound
        if (!round2 || round2.phase === 'ended') return

        const revealed = revealClue(room)
        if (revealed) {
          io.to(room.code).emit('CLUE_REVEALED', { clue: revealed })
          scheduleNext()
        }
      })
    }, delay)
  }

  scheduleNext()
}

const GRACE_PERIOD_MS = 5 * 60 * 1000

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
    const revealedClueCount = room.currentRound.revealedClueCount

    payload.gameState = {
      phase: room.currentRound.phase,
      roundNumber: room.currentRound.roundNumber,
      cluesRevealed: room.currentRound.clues.slice(0, revealedClueCount).map(c => ({
        order: c.order,
        text: c.text
      })),
      isLocked: player.isLocked,
      serverStartTime: room.currentRound.serverStartTime,
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
    payload.clues = roundResult.clues.map((c: any) => ({
      text: c.text,
      citations: c.citations
    }))
  }

  io.to(room.code).emit('ROUND_ENDED', payload)

  setTimeout(() => {
    safeTimer('broadcastRoundEnd:nextRound', () => {
      if (room.status !== 'in_progress') return

      startNextRound(room).then(() => {
        if (room.status === 'finished') {
          io.to(room.code).emit('GAME_ENDED', {
            finalScoreboard: room.finalScoreboard
          })
          return
        }

        const currentScoreboard = Array.from(room.scores.entries())
          .map(([playerId, score]) => {
            const player = room.players.get(playerId)
            return {
              playerId,
              nickname: player?.nickname || 'Unknown',
              score
            }
          })
          .sort((a, b) => b.score - a.score)

        const firstClue = room.currentRound!.clues[0]
        io.to(room.code).emit('ROUND_STARTED', {
          roundNumber: room.currentRound!.roundNumber,
          totalRounds: room.settings.totalRounds,
          serverStartTime: room.currentRound!.serverStartTime,
          roundDuration: room.settings.roundDuration,
          currentScoreboard,
          clue: {
            order: firstClue.order,
            text: firstClue.text
          }
        })

        setTimeout(() => {
          safeTimer('broadcastRoundEnd:activate', () => {
            activateRound(room)
            const roundEndDelay = room.settings.roundDuration
            room.currentRound!.timers.roundEnd = setTimeout(() => {
              safeTimer('broadcastRoundEnd:endRound', () => {
                endRound(room)
                const roundResult = room.roundHistory[room.roundHistory.length - 1]
                broadcastRoundEnd(io, room, roundResult)
              })
            }, roundEndDelay)
            scheduleClueReveals(io, room)
          })
        }, ROUND_START_DELAY_MS)
      }).catch(error => {
        logger.error('Error starting next round', error, { roomCode: room.code })
        io.to(room.code).emit('ROOM_ERROR', {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start next round'
        })
      })
    })
  }, 5000)
}

export { GRACE_PERIOD_MS }
