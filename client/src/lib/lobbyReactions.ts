export const LOBBY_REACTION_IDS = ['ready', 'wait', 'go', 'nice'] as const

export type LobbyReactionId = (typeof LOBBY_REACTION_IDS)[number]

/** How long a reaction chip stays visible on a player row. */
export const LOBBY_REACTION_TTL_MS = 3000

export interface LobbyReactionOption {
  id: LobbyReactionId
  label: string
  icon: string
}

export const LOBBY_REACTION_OPTIONS: readonly LobbyReactionOption[] = [
  { id: 'ready', label: 'Ready', icon: 'thumb_up' },
  { id: 'wait', label: 'Wait', icon: 'hourglass_empty' },
  { id: 'go', label: "Let's go", icon: 'play_arrow' },
  { id: 'nice', label: 'Nice', icon: 'favorite' }
] as const

export function isLobbyReactionId(value: unknown): value is LobbyReactionId {
  return typeof value === 'string' && (LOBBY_REACTION_IDS as readonly string[]).includes(value)
}

export function lobbyReactionLabel(id: LobbyReactionId): string {
  return LOBBY_REACTION_OPTIONS.find((option) => option.id === id)?.label ?? id
}

export function lobbyReactionIcon(id: LobbyReactionId): string {
  return LOBBY_REACTION_OPTIONS.find((option) => option.id === id)?.icon ?? 'chat_bubble'
}
