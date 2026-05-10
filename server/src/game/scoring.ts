const BASE_POINTS = 1000
const FIRST_PLACE_BONUS = 100
const FLOOR_POINTS = 50
/**
 * Score multipliers indexed by the number of clues that were revealed at
 * guess time, minus one (so index 0 = guessed off the first clue alone). We
 * scale down as more clues are out so quick guesses are rewarded, with a
 * floor of 0.6 for very late guesses on clue 5+.
 */
const CLUE_MULTIPLIERS = [1.5, 1.0, 0.8, 0.7, 0.6]
const CLUE_MULTIPLIER_FLOOR = 0.6

interface ScoreParams {
  timeElapsedMs: number
  roundDuration: number
  clueIndex: number
  isFirst: boolean
}

export function calculateScore({ timeElapsedMs, roundDuration, clueIndex, isFirst }: ScoreParams): number {
  const timeRemaining = Math.max(0, roundDuration - timeElapsedMs)
  const safeIndex = Math.max(0, Math.floor(clueIndex))
  const multiplier =
    safeIndex < CLUE_MULTIPLIERS.length ? CLUE_MULTIPLIERS[safeIndex] : CLUE_MULTIPLIER_FLOOR
  const base = Math.floor(BASE_POINTS * (timeRemaining / roundDuration) * multiplier)
  const bonus = isFirst ? FIRST_PLACE_BONUS : 0
  return Math.max(base + bonus, FLOOR_POINTS)
}
