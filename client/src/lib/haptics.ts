import { readVibrationEnabled, supportsVibration } from './preferences'

export type HapticCue = 'correct' | 'wrong' | 'timeout'

const PATTERNS: Record<HapticCue, number | number[]> = {
  correct: [30, 60, 30],
  wrong: 60,
  timeout: [120, 80, 120]
}

/** A short buzz for a guess outcome, when the device supports it and the player has it on. */
export function vibrate(cue: HapticCue): void {
  if (!supportsVibration() || !readVibrationEnabled()) return
  try {
    navigator.vibrate(PATTERNS[cue])
  } catch {
    // Some browsers throw before the page has had a tap. Nothing to do.
  }
}
