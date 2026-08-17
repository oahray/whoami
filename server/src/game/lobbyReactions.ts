export const LOBBY_REACTION_IDS = ['ready', 'wait', 'go', 'nice'] as const

export type LobbyReactionId = (typeof LOBBY_REACTION_IDS)[number]

/** Minimum gap between accepted lobby reactions per player. */
export const LOBBY_REACTION_COOLDOWN_MS = 2000

const lastReactionAt = new Map<string, number>()

export function isLobbyReactionId(value: unknown): value is LobbyReactionId {
  return typeof value === 'string' && (LOBBY_REACTION_IDS as readonly string[]).includes(value)
}

export function isLobbyReactionRateLimited(playerId: string): boolean {
  const previous = lastReactionAt.get(playerId)
  if (previous == null) return false
  return Date.now() - previous < LOBBY_REACTION_COOLDOWN_MS
}

export function markLobbyReaction(playerId: string): void {
  lastReactionAt.set(playerId, Date.now())
}

export function clearLobbyReactionRateLimit(playerId: string): void {
  lastReactionAt.delete(playerId)
}

/** Test helper. */
export function resetLobbyReactionRateLimitsForTests(): void {
  lastReactionAt.clear()
}
