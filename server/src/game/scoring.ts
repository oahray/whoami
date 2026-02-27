const BASE_POINTS = 1000
const FIRST_PLACE_BONUS = 100
const FLOOR_POINTS = 50
const CLUE_MULTIPLIERS = [1.5, 1.0]

interface ScoreParams {
  timeElapsedMs: number
  roundDuration: number
  clueIndex: number
  isFirst: boolean
}

export function calculateScore({ timeElapsedMs, roundDuration, clueIndex, isFirst }: ScoreParams): number {
  const timeRemaining = Math.max(0, roundDuration - timeElapsedMs)
  const multiplier = CLUE_MULTIPLIERS[clueIndex] ?? 1.0
  const base = Math.floor(BASE_POINTS * (timeRemaining / roundDuration) * multiplier)
  const bonus = isFirst ? FIRST_PLACE_BONUS : 0
  return Math.max(base + bonus, FLOOR_POINTS)
}
