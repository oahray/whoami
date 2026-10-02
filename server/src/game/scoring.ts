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

export type KnowledgeScoreRules = {
  basePoints: number
  additionalCluePenalty: number
  elapsedSecondPenalty: number
  incorrectGuessPenalty: number
  minimumCorrectScore: number
}

export type KnowledgeScoreInput = {
  correct: boolean
  elapsedMs: number
  revealedClueCount: number
  incorrectGuessCount: number
  bonusPoints?: number
}

export type KnowledgeScoreBreakdown = {
  score: number
  basePoints: number
  cluePenalty: number
  timePenalty: number
  incorrectGuessPenalty: number
  bonusPoints: number
}

export const DEFAULT_KNOWLEDGE_SCORE_RULES: Readonly<KnowledgeScoreRules> = {
  basePoints: 1000,
  additionalCluePenalty: 150,
  elapsedSecondPenalty: 10,
  incorrectGuessPenalty: 100,
  minimumCorrectScore: 100
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

/**
 * Product-agnostic recall scoring for Solo, Daily, and future modes.
 * Mode-specific rewards, such as a multiplayer placement bonus, can be passed
 * through `bonusPoints`.
 */
export function calculateKnowledgeScore(
  input: KnowledgeScoreInput,
  rules: KnowledgeScoreRules = DEFAULT_KNOWLEDGE_SCORE_RULES
): KnowledgeScoreBreakdown {
  const basePoints = nonNegativeInteger(rules.basePoints)
  const bonusPoints = nonNegativeInteger(input.bonusPoints ?? 0)

  if (!input.correct) {
    return {
      score: 0,
      basePoints,
      cluePenalty: 0,
      timePenalty: 0,
      incorrectGuessPenalty: 0,
      bonusPoints: 0
    }
  }

  const revealedClueCount = Math.max(1, nonNegativeInteger(input.revealedClueCount))
  const elapsedSeconds = Math.floor(nonNegativeInteger(input.elapsedMs) / 1000)
  const cluePenalty =
    Math.max(0, revealedClueCount - 1) *
    nonNegativeInteger(rules.additionalCluePenalty)
  const timePenalty =
    elapsedSeconds * nonNegativeInteger(rules.elapsedSecondPenalty)
  const incorrectGuessPenalty =
    nonNegativeInteger(input.incorrectGuessCount) *
    nonNegativeInteger(rules.incorrectGuessPenalty)
  const score = Math.max(
    nonNegativeInteger(rules.minimumCorrectScore),
    basePoints + bonusPoints - cluePenalty - timePenalty - incorrectGuessPenalty
  )

  return {
    score,
    basePoints,
    cluePenalty,
    timePenalty,
    incorrectGuessPenalty,
    bonusPoints
  }
}

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
