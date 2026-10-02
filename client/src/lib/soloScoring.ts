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
