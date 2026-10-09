import { API_BASE_URL } from './apiBase'
import type { SoloVariation } from './soloSession'

const MODE_BY_VARIATION = {
  challenge: 'classic',
  daily: 'daily',
  endurance: 'endurance',
  review: 'review'
} as const

/** Tell the server a solo game started or finished. Failure does not affect play. */
export function reportSoloPlay(variation: SoloVariation, event: 'started' | 'completed'): void {
  const mode = MODE_BY_VARIATION[variation]
  void fetch(`${API_BASE_URL}/play-totals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, event })
  }).catch(() => {
    // Totals are optional. The game continues either way.
  })
}
