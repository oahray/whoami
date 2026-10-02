import type {
  KnowledgeScoreRules,
  SoloScoreBreakdown
} from './soloSession'

export type SoloScoreRequest = {
  correct: boolean
  elapsedMs: number
  revealedClueCount: number
  incorrectGuessCount: number
}

export const FALLBACK_KNOWLEDGE_SCORE_RULES: Readonly<KnowledgeScoreRules> = {
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

/** Typical Solo card length; used to clamp legacy clue estimates. */
export const SOLO_MAX_REVEALED_CLUES = 10

/**
 * Approximate a total score for a pre-scoring Solo record.
 * Assumes no wrong guesses; spreads active time across correct rounds and
 * estimates clues from that average pace.
 */
export function estimateLegacySoloScore(
  input: {
    correctCount: number
    activeElapsedMs: number
    clueRevealIntervalMs: number
  },
  rules: KnowledgeScoreRules = FALLBACK_KNOWLEDGE_SCORE_RULES
): number {
  const correctCount = nonNegativeInteger(input.correctCount)
  if (correctCount === 0) return 0

  const perCorrectMs = Math.floor(nonNegativeInteger(input.activeElapsedMs) / correctCount)
  const intervalMs = Math.max(1, nonNegativeInteger(input.clueRevealIntervalMs))
  const revealedClueCount = Math.min(
    SOLO_MAX_REVEALED_CLUES,
    Math.max(1, 1 + Math.floor(perCorrectMs / intervalMs))
  )
  const perRound = scoreSoloRound(
    {
      correct: true,
      elapsedMs: perCorrectMs,
      revealedClueCount,
      incorrectGuessCount: 0
    },
    rules
  )
  return perRound.score * correctCount
}

export function scoreSoloRound(
  request: SoloScoreRequest,
  rules: KnowledgeScoreRules = FALLBACK_KNOWLEDGE_SCORE_RULES
): SoloScoreBreakdown {
  const basePoints = nonNegativeInteger(rules.basePoints)
  if (!request.correct) {
    return {
      score: 0,
      basePoints,
      cluePenalty: 0,
      timePenalty: 0,
      incorrectGuessPenalty: 0,
      bonusPoints: 0
    }
  }

  const cluePenalty =
    Math.max(0, Math.max(1, nonNegativeInteger(request.revealedClueCount)) - 1) *
    nonNegativeInteger(rules.additionalCluePenalty)
  const timePenalty =
    Math.floor(nonNegativeInteger(request.elapsedMs) / 1000) *
    nonNegativeInteger(rules.elapsedSecondPenalty)
  const incorrectGuessPenalty =
    nonNegativeInteger(request.incorrectGuessCount) *
    nonNegativeInteger(rules.incorrectGuessPenalty)
  const score = Math.max(
    nonNegativeInteger(rules.minimumCorrectScore),
    basePoints - cluePenalty - timePenalty - incorrectGuessPenalty
  )

  return {
    score,
    basePoints,
    cluePenalty,
    timePenalty,
    incorrectGuessPenalty,
    bonusPoints: 0
  }
}
