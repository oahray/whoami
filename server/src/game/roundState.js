import { getCluesForEntity } from '../db/entities.js'
import { buildEntityPool } from './entityPool.js'
import { calculateScore } from './scoring.js'
import { validateGuess } from './validation.js'
import { isRateLimited, hasExceededMaxGuesses } from './rateLimit.js'

/**
 * Start a new game
 * @param {Object} room - Room state
 * @returns {Promise<void>}
 */
export async function startGame(room) {
  // Build entity pool
  room.entityPool = await buildEntityPool(
    room.settings.difficultyMode,
    room.settings.totalRounds
  )

  if (room.entityPool.length === 0) {
    throw new Error('No entities available for selected difficulty')
  }

  // Reset game state
  room.status = 'in_progress'
  room.currentRound = null
  room.roundHistory = []
  room.usedEntityIds = new Set()

  // Reset all player scores and states
  for (const player of room.players.values()) {
    room.scores.set(player.id, 0)
    player.isLocked = false
    player.guessCount = 0
    player.lastGuessAt = null
  }

  // Start first round
  await startNextRound(room)
}

/**
 * Start the next round (IDLE → STARTING)
 * @param {Object} room - Room state
 * @returns {Promise<void>}
 */
export async function startNextRound(room) {
  // Check if game is finished
  if (room.roundHistory.length >= room.settings.totalRounds) {
    endGame(room)
    return
  }

  // Select next entity from pool
  const entity = room.entityPool[room.roundHistory.length]
  if (!entity) {
    endGame(room)
    return
  }

  // Load clues for this entity
  const clues = await getCluesForEntity(entity.id)
  if (clues.length < 2) {
    throw new Error(`Entity ${entity.name} has insufficient clues`)
  }

  // Reset all players for new round
  for (const player of room.players.values()) {
    player.isLocked = false
    player.guessCount = 0
    player.lastGuessAt = null
  }

  // Create round state
  room.currentRound = {
    roundNumber: room.roundHistory.length + 1,
    entity: entity,
    clues: clues,
    phase: 'starting', // 'starting' | 'active' | 'clue_revealed' | 'ended'
    serverStartTime: Date.now(),
    correctGuesses: [],
    timers: {
      clueReveal: null,
      roundEnd: null
    }
  }
}

/**
 * Transition from STARTING → ACTIVE (after 3s pre-guess countdown)
 * @param {Object} room - Room state
 */
export function activateRound(room) {
  if (!room.currentRound || room.currentRound.phase !== 'starting') {
    return
  }

  room.currentRound.phase = 'active'

  // Start clue reveal timer
  const clueRevealDelay = room.settings.clueRevealTime - 3000 // Already waited 3s
  if (clueRevealDelay > 0) {
    room.currentRound.timers.clueReveal = setTimeout(() => {
      revealClue(room)
    }, clueRevealDelay)
  } else {
    // Clue reveal time already passed, reveal immediately
    revealClue(room)
  }

  // Start round end timer (will be set by handler with callback)
  // Timer is managed by the handler to allow broadcasting
}

/**
 * Transition from ACTIVE → CLUE_REVEALED
 * @param {Object} room - Room state
 */
export function revealClue(room) {
  if (!room.currentRound) return

  // If already revealed or ended, do nothing
  if (room.currentRound.phase === 'clue_revealed' || room.currentRound.phase === 'ended') {
    return
  }

  room.currentRound.phase = 'clue_revealed'
}

/**
 * Check if all players are locked
 * @param {Object} room - Room state
 * @returns {boolean}
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
 * Process a guess submission
 * @param {Object} room - Room state
 * @param {string} playerId - Socket ID of the player
 * @param {string} guess - Player's guess
 * @returns {Object|null} Result object with correct flag and details, or null if invalid
 */
export function processGuess(room, playerId, guess) {
  if (!room.currentRound) {
    return null
  }

  const player = room.players.get(playerId)
  if (!player || !player.isConnected) {
    return null
  }

  // Guard checks
  if (room.currentRound.phase === 'starting' || room.currentRound.phase === 'ended') {
    return null // Guessing not open
  }

  if (player.isLocked) {
    return null // Player already guessed correctly
  }

  if (isRateLimited(player)) {
    return null // Rate limited
  }

  if (hasExceededMaxGuesses(player, room)) {
    return null // Exceeded max guesses
  }

  // Update rate limiting state
  player.lastGuessAt = Date.now()
  player.guessCount++

  // Validate guess
  const isCorrect = validateGuess(
    guess,
    room.currentRound.entity.name,
    room.settings.strictMode
  )

  if (isCorrect) {
    // Calculate score
    const timeElapsed = Date.now() - room.currentRound.serverStartTime
    const clueIndex = room.currentRound.phase === 'clue_revealed' ? 1 : 0
    const position = room.currentRound.correctGuesses.length + 1
    const points = calculateScore({
      timeElapsedMs: timeElapsed,
      roundDuration: room.settings.roundDuration,
      clueIndex,
      isFirst: position === 1
    })

    // Record correct guess
    room.currentRound.correctGuesses.push({
      playerId,
      nickname: player.nickname,
      timeElapsedMs: timeElapsed,
      clueIndex,
      position,
      pointsEarned: points
    })

    // Update player state
    player.isLocked = true
    room.scores.set(playerId, (room.scores.get(playerId) || 0) + points)

    // Check if all players locked - end round early
    if (allPlayersLocked(room)) {
      // Clear timers
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

/**
 * End the current round (transition to ENDED)
 * @param {Object} room - Room state
 */
export function endRound(room) {
  if (!room.currentRound || room.currentRound.phase === 'ended') {
    return
  }

  // Clear any active timers
  if (room.currentRound.timers.clueReveal) {
    clearTimeout(room.currentRound.timers.clueReveal)
    room.currentRound.timers.clueReveal = null
  }
  if (room.currentRound.timers.roundEnd) {
    clearTimeout(room.currentRound.timers.roundEnd)
    room.currentRound.timers.roundEnd = null
  }

  room.currentRound.phase = 'ended'

  // Build scoreboard for this round
  const scoreboard = room.currentRound.correctGuesses.map(guess => {
    const player = room.players.get(guess.playerId)
    return {
      playerId: guess.playerId,
      nickname: guess.nickname,
      timeElapsedMs: guess.timeElapsedMs,
      pointsEarned: guess.pointsEarned,
      totalScore: room.scores.get(guess.playerId) || 0
    }
  }).sort((a, b) => a.timeElapsedMs - b.timeElapsedMs) // Sort by time (fastest first)

  // Save round result
  const roundResult = {
    roundNumber: room.currentRound.roundNumber,
    entity: room.currentRound.entity,
    clues: room.currentRound.clues,
    correctGuesses: room.currentRound.correctGuesses,
    scoreboard,
    answerRevealed: room.currentRound.correctGuesses.length > 0
  }

  room.roundHistory.push(roundResult)
}

/**
 * End the game
 * @param {Object} room - Room state
 */
export function endGame(room) {
  room.status = 'finished'
  room.currentRound = null

  // Build final scoreboard
  const finalScoreboard = Array.from(room.scores.entries())
    .map(([playerId, score]) => {
      const player = room.players.get(playerId)
      return {
        playerId,
        nickname: player?.nickname || 'Unknown',
        score
      }
    })
    .sort((a, b) => b.score - a.score) // Sort by score (highest first)

  room.finalScoreboard = finalScoreboard
}
