/** Spoiler-free room efficiency rollups for finished multiplayer games. */

export type GameHistoryEfficiency = {
  roundsPlayed: number
  roundsSolved: number
  firstClueSolves: number
  /** Average clues showing at the first correct guess; null if none solved. */
  avgCluesWhenSolved: number | null
}

type RoundLike = {
  correctGuesses?: Array<{ clueIndex?: number }>
  clues?: unknown[]
}

/**
 * Derive collective efficiency from round history.
 * Uses the earliest correct guess's clue index (clue 1 = index 0).
 * Returns undefined when there is no round history (legacy / empty).
 */
export function computeGameEfficiency(
  roundHistory: RoundLike[] | undefined | null
): GameHistoryEfficiency | undefined {
  if (!Array.isArray(roundHistory) || roundHistory.length === 0) return undefined

  let roundsSolved = 0
  let firstClueSolves = 0
  let clueSum = 0

  for (const round of roundHistory) {
    const guesses = Array.isArray(round?.correctGuesses) ? round.correctGuesses : []
    if (guesses.length === 0) continue

    roundsSolved += 1
    const clueIndexes = guesses
      .map((guess) => guess?.clueIndex)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    let cluesWhenSolved: number
    if (clueIndexes.length > 0) {
      const minIndex = Math.min(...clueIndexes)
      cluesWhenSolved = Math.max(1, minIndex + 1)
      if (minIndex === 0) firstClueSolves += 1
    } else {
      const fallback = Array.isArray(round?.clues) ? round.clues.length : 1
      cluesWhenSolved = Math.max(1, fallback)
    }
    clueSum += cluesWhenSolved
  }

  return {
    roundsPlayed: roundHistory.length,
    roundsSolved,
    firstClueSolves,
    avgCluesWhenSolved:
      roundsSolved > 0 ? Math.round((clueSum / roundsSolved) * 10) / 10 : null
  }
}
