/**
 * Maps server-emitted error codes (`ROOM_ERROR { code, message }`) to friendly,
 * user-facing copy. Never returns a raw stack trace or unknown server string -
 * unknown codes always fall back to a generic friendly message and the raw
 * payload is logged to the console for devs.
 */

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'GAME_IN_PROGRESS'
  | 'NOT_HOST'
  | 'INSUFFICIENT_PLAYERS'
  | 'INVALID_PAYLOAD'
  | 'PLAYER_NOT_FOUND'
  | 'GUESSING_NOT_OPEN'
  | 'PLAYER_LOCKED'
  | 'GUESS_RATE_LIMITED'
  | 'NICKNAME_TAKEN'
  | 'ROOM_FULL'
  | 'INVALID_SETTINGS'
  | 'INTERNAL_ERROR'
  | 'CONNECTION_LOST'
  | 'CONNECTION_FAILED'
  | 'RECONNECTION_FAILED'
  | 'PLAYER_BANNED'
  | 'NO_DATASET'
  | 'DATASET_DISABLED'
  | 'NO_ENTITIES'

const errorMessages: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: 'This room no longer exists. Please create or join a different room.',
  GAME_IN_PROGRESS: 'This game is already in progress. Please wait for it to finish or join a different room.',
  NOT_HOST: 'Only the room host can perform this action.',
  INSUFFICIENT_PLAYERS: 'You need at least 2 players to start a game.',
  INVALID_PAYLOAD: 'That request was invalid. Please try again.',
  PLAYER_NOT_FOUND: 'Your player information could not be found. Please rejoin the room.',
  GUESSING_NOT_OPEN: 'Guessing is not currently open. Please wait for the round to start.',
  PLAYER_LOCKED: 'You have already guessed correctly this round. Wait for the next round!',
  GUESS_RATE_LIMITED: 'Please wait a moment before guessing again.',
  NICKNAME_TAKEN: 'This nickname is already taken. Please choose a different one.',
  PLAYER_BANNED: 'You have been removed from this room and cannot rejoin it.',
  ROOM_FULL: 'This room is full. Please join a different room.',
  INVALID_SETTINGS: 'Those game settings are invalid. Please check your values and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again or refresh the page.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect…',
  CONNECTION_FAILED: 'Could not reach the server. Please check your connection and try again.',
  RECONNECTION_FAILED: 'Failed to reconnect. Please refresh the page and try again.',
  NO_DATASET: 'No content set is available yet. Ask an admin to enable one.',
  DATASET_DISABLED: 'The selected content set has been disabled. Pick another to start.',
  NO_ENTITIES: 'This content set has no playable entities yet. Try a different set.'
}

/**
 * Codes whose server-side message is intentionally more specific than the
 * generic mapped copy (e.g. INVALID_SETTINGS may say "Round duration must be
 * between 10s and 60s"). For these, the server message wins when present.
 *
 * The server message is still validated to be a non-empty string before use,
 * so we never surface `undefined`/`null`/`""` to the UI.
 */
const PREFER_SERVER_MESSAGE_CODES = new Set<ErrorCode>([
  'INVALID_SETTINGS',
  'INVALID_PAYLOAD'
])

function isKnownCode(code: string): code is ErrorCode {
  return code in errorMessages
}

function isUsableServerMessage(message: unknown): message is string {
  return typeof message === 'string' && message.trim().length > 0
}

/**
 * Resolve a friendly user-facing string for a `ROOM_ERROR { code, message }`
 * payload.
 *
 * - Known code in `PREFER_SERVER_MESSAGE_CODES`: server message wins, falling
 *   back to the mapped friendly copy if the server didn't send one.
 * - Other known code: mapped friendly copy (server message is ignored).
 * - Unknown code: generic INTERNAL_ERROR message; the raw payload is logged
 *   to the console for developers but is NOT surfaced to the user.
 */
export function getErrorMessage(code: string, serverMessage?: unknown): string {
  if (isKnownCode(code)) {
    if (PREFER_SERVER_MESSAGE_CODES.has(code) && isUsableServerMessage(serverMessage)) {
      return serverMessage
    }
    return errorMessages[code]
  }

  if (typeof console !== 'undefined') {
    console.warn(
      `[errorMessages] Unknown ROOM_ERROR code "${code}" - falling back to generic copy.`,
      { serverMessage }
    )
  }
  return errorMessages.INTERNAL_ERROR
}

/**
 * Fatal codes wipe the persisted room state so the user starts fresh on
 * their next attempt instead of looping into the same dead room.
 */
export function isFatalError(code: string): boolean {
  return [
    'ROOM_NOT_FOUND',
    'GAME_IN_PROGRESS',
    'RECONNECTION_FAILED',
    'PLAYER_BANNED'
  ].includes(code)
}
