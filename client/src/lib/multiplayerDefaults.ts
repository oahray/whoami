export type MultiplayerTransparencyMode = 'full' | 'minimal'
export type MultiplayerEntityType = 'character' | 'place' | 'all'

/** Pause after ROUND_ENDED before the next round starts (must match server). */
export const INTER_ROUND_DELAY_MS = 10_000

/** Finished games kept in this browser's device archive. */
export const DEVICE_ARCHIVE_MAX = 50

/** Do not schedule a clue reveal this close to round end (must match server validation). */
export const CLUE_REVEAL_ROUND_TAIL_BUFFER_MS = 1500

export const MULTIPLAYER_SETTINGS_LIMITS = {
  roundDuration: { min: 10_000, max: 60_000, step: 5_000 },
  clueRevealTime: { min: 2_000, step: 1_000 },
  totalRounds: { min: 3, max: 10 },
  maxGuessesPerRound: { min: 1, max: 50 }
} as const

export const DEFAULT_MULTIPLAYER_SETTINGS = {
  roundDuration: 30_000,
  clueRevealTime: 5_000,
  totalRounds: 5,
  difficultyMode: 'any',
  strictMode: false,
  transparencyMode: 'full' as MultiplayerTransparencyMode,
  maxGuessesPerRound: 30,
  datasetId: null as string | null,
  entityType: 'character' as MultiplayerEntityType
} as const

export type DefaultMultiplayerSettings = typeof DEFAULT_MULTIPLAYER_SETTINGS

/** Host “reset defaults” payload (waiting lobby only). */
export function multiplayerSettingsResetPayload(): DefaultMultiplayerSettings {
  return { ...DEFAULT_MULTIPLAYER_SETTINGS }
}

export function maxClueRevealTimeMs(roundDurationMs: number): number {
  return Math.max(
    MULTIPLAYER_SETTINGS_LIMITS.clueRevealTime.min,
    roundDurationMs - CLUE_REVEAL_ROUND_TAIL_BUFFER_MS
  )
}
