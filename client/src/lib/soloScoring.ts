import { API_BASE_URL } from './apiBase'
import type { SoloScoreBreakdown } from './soloSession'

export type SoloScoreRequest = {
  correct: boolean
  elapsedMs: number
  revealedClueCount: number
  incorrectGuessCount: number
}

export async function scoreSoloRound(
  request: SoloScoreRequest
): Promise<SoloScoreBreakdown> {
  const response = await fetch(`${API_BASE_URL}/cards/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to score round (${response.status})`)
  }
  return (await response.json()) as SoloScoreBreakdown
}
