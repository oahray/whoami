import { API_BASE_URL } from './apiBase'
import type { SoloVariation } from './soloSession'

const MODE_BY_VARIATION = {
  challenge: 'classic',
  daily: 'daily',
  endurance: 'endurance',
  review: 'review'
} as const

function reportPassPlay(event: 'started' | 'loaded'): void {
  void fetch(`${API_BASE_URL}/play-totals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'pass', event })
  }).catch(() => {
    // Totals are optional. The game continues either way.
  })
}

/** A new pass & play game. Reloading the same game does not count again. */
export function reportPassAndPlayStart(): void {
  reportPassPlay('started')
}

/** One character whose card was loaded from the server. */
export function reportPassAndPlayCharacter(): void {
  reportPassPlay('loaded')
}

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
