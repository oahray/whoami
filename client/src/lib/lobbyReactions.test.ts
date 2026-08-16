import { describe, expect, it } from 'vitest'
import {
  isLobbyReactionId,
  LOBBY_REACTION_OPTIONS,
  lobbyReactionIcon,
  lobbyReactionLabel
} from './lobbyReactions'

describe('lobbyReactions', () => {
  it('accepts only the fixed reaction ids', () => {
    expect(isLobbyReactionId('ready')).toBe(true)
    expect(isLobbyReactionId('wait')).toBe(true)
    expect(isLobbyReactionId('go')).toBe(true)
    expect(isLobbyReactionId('nice')).toBe(true)
    expect(isLobbyReactionId('custom')).toBe(false)
    expect(isLobbyReactionId(null)).toBe(false)
  })

  it('exposes four canned options with labels and icons', () => {
    expect(LOBBY_REACTION_OPTIONS).toHaveLength(4)
    expect(lobbyReactionLabel('go')).toBe("Let's go")
    expect(lobbyReactionIcon('wait')).toBe('hourglass_empty')
  })
})
