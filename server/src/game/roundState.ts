import { getCluesForEntity, getDataset, getDefaultEnabledDataset } from '../db/entities.js'
import type { GameDifficultyMode } from '../db/entities.js'
import { buildEntityPool } from './entityPool.js'
import { calculateScore } from './scoring.js'
import { validateGuess } from './validation.js'
import { isRateLimited, hasExceededMaxGuesses } from './rateLimit.js'
import type { RoomState } from '../rooms/store.js'

export class GameStartError extends Error {
  constructor(
    public readonly code: 'NO_DATASET' | 'DATASET_DISABLED' | 'NO_ENTITIES',
    message: string
  ) {
    super(message)
    this.name = 'GameStartError'
  }
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function startGame(room: RoomState): Promise<void> {
  let datasetId = room.settings.datasetId
  if (datasetId) {
    const dataset = await getDataset(datasetId)
    if (!dataset) {
      throw new GameStartError('NO_DATASET', 'Selected dataset no longer exists')
    }
    if (!dataset.is_enabled) {
      throw new GameStartError(
        'DATASET_DISABLED',
        'Selected dataset is disabled. Pick another dataset to start.'
      )
    }
  } else {
    const fallback = await getDefaultEnabledDataset()
    if (!fallback) {
      throw new GameStartError(
        'NO_DATASET',
        'No enabled dataset is available. An admin must enable one before starting a game.'
      )
    }
    datasetId = fallback.id
    room.settings.datasetId = datasetId
  }

  room.entityPool = (await buildEntityPool(
    room.settings.difficultyMode,
    room.settings.totalRounds,
    datasetId
  )) as any

  if (room.entityPool.length === 0) {
    throw new GameStartError(
      'NO_ENTITIES',
      'This dataset has no playable entities. Add at least two clue-tagged entities first.'
    )
  }

  room.status = 'in_progress'
  room.currentRound = null
  room.roundHistory = []
  room.usedEntityIds = new Set()

  for (const player of room.players.values()) {
    room.scores.set(player.id, 0)
    player.isLocked = false
    player.guessCount = 0
    player.lastGuessAt = null
  }

  await startNextRound(room)
}

export async function startNextRound(room: RoomState): Promise<void> {
  if (room.roundHistory.length >= room.settings.totalRounds) {
    endGame(room)
    return
  }

  const entity = room.entityPool[room.roundHistory.length]
  if (!entity) {
    endGame(room)
    return
  }

  const clues = await getCluesForEntity(entity.id, {
    difficultyMode: room.settings.difficultyMode as GameDifficultyMode
  })
  if (clues.length < 2) {
    throw new Error(`Entity ${entity.name} has insufficient clues`)
  }

  for (const player of room.players.values()) {
    player.isLocked = false
    player.guessCount = 0
    player.lastGuessAt = null
  }

  const shuffledClues = shuffle(clues)

  room.currentRound = {
    roundNumber: room.roundHistory.length + 1,
    entity: entity,
    clues: shuffledClues.map((c, index) => ({
      id: c.id,
      order: index + 1,
      text: c.text,
      citations: c.citations
    })),
    phase: 'starting',
    serverStartTime: Date.now(),
    activeStartTime: null,
    revealedClueCount: 1,
    correctGuesses: [],
    timers: {
      clueReveal: null,
      roundEnd: null
    }
  }
}

export function activateRound(room: RoomState): void {
  if (!room.currentRound || room.currentRound.phase !== 'starting') {
    return
  }

  room.currentRound.phase = 'active'
  room.currentRound.activeStartTime = Date.now()
}

/**
 * Reveal the next clue (state-only). Returns the freshly-revealed clue, or
 * `null` if there are no more clues or the round is over. Callers are
 * responsible for emitting CLUE_REVEALED to the room.
 */
export function revealClue(room: RoomState): { order: number; text: string } | null {
  if (!room.currentRound) return null
  if (room.currentRound.phase === 'ended') return null
  if (room.currentRound.revealedClueCount >= room.currentRound.clues.length) return null

  const nextIndex = room.currentRound.revealedClueCount
  const clue = room.currentRound.clues[nextIndex]
  room.currentRound.revealedClueCount = nextIndex + 1
  room.currentRound.phase = 'clue_revealed'
  return { order: clue.order, text: clue.text }
}

function allPlayersLocked(room: RoomState): boolean {
  for (const player of room.players.values()) {
    if (player.isConnected && !player.isLocked) {
      return false
    }
  }
  return true
}

interface GuessResult {
  correct: boolean
  position?: number
  timeElapsedMs?: number
  pointsEarned?: number
}

export function processGuess(room: RoomState, playerId: string, guess: string): GuessResult | null {
  if (!room.currentRound) {
    return null
  }

  const player = room.players.get(playerId)
  if (!player || !player.isConnected) {
    return null
  }

  if (room.currentRound.phase === 'starting' || room.currentRound.phase === 'ended') {
    return null
  }

  if (player.isLocked) {
    return null
  }

  if (isRateLimited(player)) {
    return null
  }

  if (hasExceededMaxGuesses(player, room)) {
    return null
  }

  player.lastGuessAt = Date.now()
  player.guessCount++

  const isCorrect = validateGuess(
    guess,
    room.currentRound.entity.name,
    room.settings.strictMode,
    room.currentRound.entity.aliases ?? []
  )

  if (isCorrect) {
    const referenceStart = room.currentRound.activeStartTime ?? room.currentRound.serverStartTime
    const timeElapsed = Math.max(0, Date.now() - referenceStart)
    const clueIndex = Math.max(0, room.currentRound.revealedClueCount - 1)
    const position = room.currentRound.correctGuesses.length + 1
    const points = calculateScore({
      timeElapsedMs: timeElapsed,
      roundDuration: room.settings.roundDuration,
      clueIndex,
      isFirst: position === 1
    })

    room.currentRound.correctGuesses.push({
      playerId,
      nickname: player.nickname,
      timeElapsedMs: timeElapsed,
      clueIndex,
      position,
      pointsEarned: points
    })

    player.isLocked = true
    room.scores.set(playerId, (room.scores.get(playerId) || 0) + points)

    if (allPlayersLocked(room)) {
      if (room.currentRound.timers.clueReveal) {
        clearTimeout(room.currentRound.timers.clueReveal)
      }
      if (room.currentRound.timers.roundEnd) {
        clearTimeout(room.currentRound.timers.roundEnd)
      }
      endRound(room)
    }

    return {
      correct: true,
      position,
      timeElapsedMs: timeElapsed,
      pointsEarned: points
    }
  }

  return {
    correct: false
  }
}

export function endRound(room: RoomState): void {
  if (!room.currentRound || room.currentRound.phase === 'ended') {
    return
  }

  if (room.currentRound.timers.clueReveal) {
    clearTimeout(room.currentRound.timers.clueReveal)
    room.currentRound.timers.clueReveal = null
  }
  if (room.currentRound.timers.roundEnd) {
    clearTimeout(room.currentRound.timers.roundEnd)
    room.currentRound.timers.roundEnd = null
  }

  room.currentRound.phase = 'ended'

  const correctMap = new Map(
    room.currentRound.correctGuesses.map(g => [g.playerId, g])
  )

  const scoreboard = Array.from(room.players.entries()).map(([pid, player]) => {
    const correct = correctMap.get(pid)
    return {
      playerId: pid,
      nickname: player.nickname,
      timeElapsedMs: correct?.timeElapsedMs ?? 0,
      pointsEarned: correct?.pointsEarned ?? 0,
      totalScore: room.scores.get(pid) || 0
    }
  }).sort((a, b) => b.totalScore - a.totalScore)

  const revealedClueCount = room.currentRound.revealedClueCount
  const cluesForRound = room.currentRound.clues.slice(0, revealedClueCount)

  const roundResult = {
    roundNumber: room.currentRound.roundNumber,
    entity: room.currentRound.entity,
    clues: cluesForRound,
    correctGuesses: room.currentRound.correctGuesses,
    scoreboard,
    answerRevealed: room.currentRound.correctGuesses.length > 0
  }

  room.roundHistory.push(roundResult)
}

export function endGame(room: RoomState): void {
  room.status = 'finished'
  room.currentRound = null

  const finalScoreboard = Array.from(room.scores.entries())
    .map(([playerId, score]) => {
      const player = room.players.get(playerId)
      return {
        playerId,
        nickname: player?.nickname || 'Unknown',
        score
      }
    })
    .sort((a, b) => b.score - a.score)

  room.finalScoreboard = finalScoreboard
}

export function resetRoomForNewGame(room: RoomState): void {
  room.status = 'waiting'
  room.currentRound = null
  room.roundHistory = []
  room.entityPool = []
  room.usedEntityIds.clear()
  room.scores.clear()
  room.finalScoreboard = undefined

  for (const player of room.players.values()) {
    player.guessCount = 0
    player.lastGuessAt = null
    player.isLocked = false
  }
}
