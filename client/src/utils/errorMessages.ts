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
  | 'RECONNECTION_FAILED'
  | 'PLAYER_BANNED'

const errorMessages: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: 'This room no longer exists. Please create or join a different room.',
  GAME_IN_PROGRESS: 'This game is already in progress. Please wait for it to finish or join a different room.',
  NOT_HOST: 'Only the room host can perform this action.',
  INSUFFICIENT_PLAYERS: 'You need at least 2 players to start a game.',
  INVALID_PAYLOAD: 'Invalid request. Please try again.',
  PLAYER_NOT_FOUND: 'Your player information could not be found. Please rejoin the room.',
  GUESSING_NOT_OPEN: 'Guessing is not currently open. Please wait for the round to start.',
  PLAYER_LOCKED: 'You have already guessed correctly this round. Wait for the next round!',
  GUESS_RATE_LIMITED: 'Please wait a moment before guessing again.',
  NICKNAME_TAKEN: 'This nickname is already taken. Please choose a different one.',
  PLAYER_BANNED: 'You have been removed from this room and cannot rejoin it.',
  ROOM_FULL: 'This room is full (maximum 5 players). Please join a different room.',
  INVALID_SETTINGS: 'Invalid game settings. Please check your values and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again or refresh the page.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  RECONNECTION_FAILED: 'Failed to reconnect. Please refresh the page and try again.'
}

export function getErrorMessage(code: string, fallback?: string): string {
  if (code in errorMessages) {
    return errorMessages[code as ErrorCode]
  }
  return fallback || errorMessages.INTERNAL_ERROR
}

export function isFatalError(code: string): boolean {
  return [
    'ROOM_NOT_FOUND',
    'GAME_IN_PROGRESS',
    'RECONNECTION_FAILED'
  ].includes(code)
}
