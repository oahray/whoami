import { Server } from 'socket.io'
import type { RoomState, Player } from '../../rooms/store.js'
import { startNextRound, activateRound, endRound, revealClue } from '../../game/roundState'
import {
  ROUND_START_DELAY_MS,
  INTER_ROUND_DELAY_MS,
  CLUE_REVEAL_ROUND_TAIL_BUFFER_MS
} from '../../game/multiplayerDefaults.js'
import { signHistoryArchive } from '../../game/historyArchive.js'
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
const CLUE_TAIL_BUFFER_MS = CLUE_REVEAL_ROUND_TAIL_BUFFER_MS

function remainingMs(deadline: number, now = Date.now()): number {
  return Math.max(0, deadline - now)
}

function buildCurrentScoreboard(room: RoomState) {
  return Array.from(room.scores.entries())
    .map(([playerId, score]) => {
      const player = room.players.get(playerId)
      return {
        playerId,
        nickname: player?.nickname || 'Unknown',
        score
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function emitRoundStarted(io: Server, room: RoomState): void {
  if (!room.currentRound) return
  const firstClue = room.currentRound.clues[0]
  io.to(room.code).emit('ROUND_STARTED', {
    roundNumber: room.currentRound.roundNumber,
    totalRounds: room.settings.totalRounds,
    serverStartTime: room.currentRound.serverStartTime,
    roundDuration: room.settings.roundDuration,
    currentScoreboard: buildCurrentScoreboard(room),
    clue: {
      order: firstClue.order,
      text: firstClue.text
    }
  })
}

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

/** End the round when wall-clock time from `activeStartTime` is exhausted. */
export function scheduleRoundEnd(io: Server, room: RoomState, now = Date.now()): void {
  const round = room.currentRound
  if (!round || round.phase === 'ended' || round.phase === 'starting') return
  if (round.activeStartTime == null) return

  if (round.timers.roundEnd) {
    clearTimeout(round.timers.roundEnd)
    round.timers.roundEnd = null
  }

  const delay = remainingMs(round.activeStartTime + room.settings.roundDuration, now)
  round.timers.roundEnd = setTimeout(() => {
    safeTimer('scheduleRoundEnd:fire', () => {
      if (!room.currentRound || room.currentRound.phase === 'ended') return
      endRound(room)
      const roundResult = room.roundHistory[room.roundHistory.length - 1]
      broadcastRoundEnd(io, room, roundResult)
    })
  }, delay)
}

/** Activate guessing + arm active-round timers (clues + round end). */
export function armActiveRound(io: Server, room: RoomState, now = Date.now()): void {
  if (!room.currentRound) return
  if (room.currentRound.phase === 'starting') {
    activateRound(room)
  }
  if (!room.currentRound || room.currentRound.phase === 'ended') return
  scheduleRoundEnd(io, room, now)
  scheduleClueReveals(io, room)
}

/**
 * Schedule (or immediately run) the pre-round countdown → active transition
 * from `serverStartTime + ROUND_START_DELAY_MS`.
 */
export function scheduleRoundActivation(io: Server, room: RoomState, now = Date.now()): void {
  const round = room.currentRound
  if (!round || round.phase !== 'starting') return

  const delay = remainingMs(round.serverStartTime + ROUND_START_DELAY_MS, now)
  setTimeout(() => {
    safeTimer('scheduleRoundActivation:fire', () => {
      armActiveRound(io, room)
    })
  }, delay)
}

/**
 * After ROUND_ENDED, wait for the inter-round pause then start the next round
 * (or end the game). Uses `roundEndedAt` when present so hydrate can resume
 * the remaining delay; otherwise waits a full INTER_ROUND_DELAY_MS from now.
 */
export function scheduleInterRoundAdvance(io: Server, room: RoomState, now = Date.now()): void {
  const endedAt = room.currentRound?.roundEndedAt
  const delay =
    endedAt != null ? remainingMs(endedAt + INTER_ROUND_DELAY_MS, now) : INTER_ROUND_DELAY_MS

  setTimeout(() => {
    safeTimer('scheduleInterRoundAdvance:nextRound', () => {
      if (room.status !== 'in_progress') return

      startNextRound(room)
        .then(() => {
          if (room.status === 'finished') {
            emitGameEnded(io, room)
            return
          }

          emitRoundStarted(io, room)
          scheduleRoundActivation(io, room)
        })
        .catch((error) => {
          logger.error('Error starting next round', error, { roomCode: room.code })
          io.to(room.code).emit('ROOM_ERROR', {
            code: 'INTERNAL_ERROR',
            message: 'Failed to start next round'
          })
        })
    })
  }, delay)
}

/**
 * Re-arm in-process timers for a hydrated room. Timers run even with no
 * connected sockets; rejoining clients pick up state via reconnect payload.
 */
export function rearmRoomTimers(io: Server, room: RoomState, now = Date.now()): void {
  if (room.status !== 'in_progress' || !room.currentRound) return

  const phase = room.currentRound.phase
  if (phase === 'starting') {
    scheduleRoundActivation(io, room, now)
    return
  }
  if (phase === 'ended') {
    scheduleInterRoundAdvance(io, room, now)
    return
  }
  // active | clue_revealed
  armActiveRound(io, room, now)
}

export function rearmAllHydratedRoomTimers(io: Server, rooms: RoomState[], now = Date.now()): number {
  let rearmed = 0
  for (const room of rooms) {
    if (room.status !== 'in_progress' || !room.currentRound) continue
    rearmRoomTimers(io, room, now)
    rearmed += 1
  }
  if (rearmed > 0) {
    logger.info('Re-armed room timers after hydrate', { rearmed })
  }
  return rearmed
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

export function toPublicPlayer(player: Player) {
  return {
    id: player.id,
    nickname: player.nickname,
    avatarId: player.avatarId,
    isHost: player.isHost,
    isConnected: player.isConnected
  }
}

export function emitGameEnded(io: Server, room: RoomState): void {
  const latest = room.gameHistory[room.gameHistory.length - 1]
  const base = {
    finalScoreboard: room.finalScoreboard,
    gameHistory: room.gameHistory
  }
  for (const player of room.players.values()) {
    if (!player.isConnected) continue
    const signedArchive = latest
      ? signHistoryArchive(latest, room.code, player.id)
      : undefined
    io.to(player.id).emit('GAME_ENDED', {
      ...base,
      ...(signedArchive ? { signedArchive } : {})
    })
  }
}

export function buildReconnectPayload(room: RoomState, player: Player) {
  const payload: any = {
    playerId: player.id,
    isHost: player.isHost,
    players: Array.from(room.players.values()).map(toPublicPlayer),
    settings: room.settings,
    gameHistory: room.gameHistory
  }

  if (room.status === 'in_progress' && room.currentRound) {
    const revealedClueCount = room.currentRound.revealedClueCount

    payload.gameState = {
      phase: room.currentRound.phase,
      roundNumber: room.currentRound.roundNumber,
      // Same shuffled array as live players — never reshuffle on reconnect.
      cluesRevealed: room.currentRound.clues.slice(0, revealedClueCount).map(c => ({
        order: c.order,
        text: c.text
      })),
      isLocked: player.isLocked,
      serverStartTime: room.currentRound.serverStartTime,
      activeStartTime: room.currentRound.activeStartTime,
      currentScoreboard: buildCurrentScoreboard(room)
    }
  }

  const latest = room.gameHistory[room.gameHistory.length - 1]
  if (latest && (room.status === 'finished' || room.status === 'waiting')) {
    const signedArchive = signHistoryArchive(latest, room.code, player.id)
    if (signedArchive) payload.signedArchive = signedArchive
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
  scheduleInterRoundAdvance(io, room)
}

export { GRACE_PERIOD_MS }
