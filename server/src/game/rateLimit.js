/**
 * Check if player is rate limited (1 guess per second)
 * @param {Object} player - Player object with lastGuessAt timestamp
 * @returns {boolean} True if rate limited
 */
export function isRateLimited(player) {
  if (!player.lastGuessAt) return false

  const timeSinceLastGuess = Date.now() - player.lastGuessAt
  return timeSinceLastGuess < 1000 // 1 second
}

/**
 * Check if player has exceeded max guesses per round
 * @param {Object} player - Player object with guessCount
 * @param {Object} room - Room object with settings.maxGuessesPerRound
 * @returns {boolean} True if exceeded max guesses
 */
export function hasExceededMaxGuesses(player, room) {
  const maxGuesses = room.settings?.maxGuessesPerRound || 10
  return player.guessCount >= maxGuesses
}
