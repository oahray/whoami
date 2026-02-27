interface Player {
  lastGuessAt: number | null
  guessCount: number
}

interface Room {
  settings?: {
    maxGuessesPerRound?: number
  }
}

export function isRateLimited(player: Player): boolean {
  if (!player.lastGuessAt) return false
  const timeSinceLastGuess = Date.now() - player.lastGuessAt
  return timeSinceLastGuess < 1000
}

export function hasExceededMaxGuesses(player: Player, room: Room): boolean {
  const maxGuesses = room.settings?.maxGuessesPerRound || 10
  return player.guessCount >= maxGuesses
}
