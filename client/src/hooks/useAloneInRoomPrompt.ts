import { useEffect, useRef, useState } from 'react'

type RoomPlayer = { id: string }

/**
 * Opens when the room drops from multiple players to only the local player
 * (leave/kick/disconnect grace expiry). Does not open for a room created alone.
 */
export function useAloneInRoomPrompt(
  players: RoomPlayer[],
  playerId: string | null
): {
  alonePromptOpen: boolean
  dismissAlonePrompt: () => void
} {
  const [alonePromptOpen, setAlonePromptOpen] = useState(false)
  const previousCountRef = useRef(players.length)

  useEffect(() => {
    const previousCount = previousCountRef.current
    const nextCount = players.length
    previousCountRef.current = nextCount

    if (nextCount > 1) {
      setAlonePromptOpen(false)
      return
    }

    const onlyLocalPlayer =
      nextCount === 1 &&
      playerId != null &&
      players[0]?.id === playerId

    if (previousCount > 1 && onlyLocalPlayer) {
      setAlonePromptOpen(true)
    }
  }, [players, playerId])

  return {
    alonePromptOpen,
    dismissAlonePrompt: () => setAlonePromptOpen(false)
  }
}
