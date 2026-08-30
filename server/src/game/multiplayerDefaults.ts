export type MultiplayerTransparencyMode = 'full' | 'minimal'
export type MultiplayerEntityType = 'character' | 'place' | 'all'

/** Pre-round countdown before guessing opens (server activateRound). */
export const ROUND_START_DELAY_MS = 3000

/** Pause after ROUND_ENDED before the next round starts. */
export const INTER_ROUND_DELAY_MS = 10_000

/** Finished games kept on a live room (session lifetime only). */
export const GAME_HISTORY_MAX = 10

/** Do not schedule a clue reveal this close to round end (scheduleClueReveals). */
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

/** Initial room.settings when a host creates a room. */
export function createDefaultMultiplayerRoomSettings() {
  return {
    ...DEFAULT_MULTIPLAYER_SETTINGS,
    roundStartDelayMs: ROUND_START_DELAY_MS
  }
}

export function maxClueRevealTimeMs(roundDurationMs: number): number {
  return Math.max(
    MULTIPLAYER_SETTINGS_LIMITS.clueRevealTime.min,
    roundDurationMs - CLUE_REVEAL_ROUND_TAIL_BUFFER_MS
  )
}
