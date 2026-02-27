const BASE_POINTS = 1000
const FIRST_PLACE_BONUS = 100
const FLOOR_POINTS = 50
const CLUE_MULTIPLIERS = [1.5, 1.0] // index 0 = clue 1, index 1 = clue 2

/**
 * Calculate score for a correct guess
 * @param {Object} params
 * @param {number} params.timeElapsedMs - Time elapsed since round start in milliseconds
 * @param {number} params.roundDuration - Total round duration in milliseconds
 * @param {number} params.clueIndex - Index of clue active when guess was made (0 = clue 1, 1 = clue 2)
 * @param {boolean} params.isFirst - Whether this is the first correct guess
 * @returns {number} Points earned
 */
export function calculateScore({ timeElapsedMs, roundDuration, clueIndex, isFirst }) {
  const timeRemaining = Math.max(0, roundDuration - timeElapsedMs)
  const multiplier = CLUE_MULTIPLIERS[clueIndex] ?? 1.0
  const base = Math.floor(BASE_POINTS * (timeRemaining / roundDuration) * multiplier)
  const bonus = isFirst ? FIRST_PLACE_BONUS : 0
  return Math.max(base + bonus, FLOOR_POINTS)
}
