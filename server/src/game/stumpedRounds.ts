export type StumpedRound = { roundNumber: number; answer: string }

type RoundLike = {
  roundNumber?: number
  entity?: { name?: string }
  correctGuesses?: unknown[]
}

/** Finished rounds nobody guessed. Answers were already revealed at each round's end. */
export function findStumpedRounds(roundHistory: RoundLike[] | undefined | null): StumpedRound[] {
  if (!Array.isArray(roundHistory)) return []
  return roundHistory
    .filter((round) => !Array.isArray(round?.correctGuesses) || round.correctGuesses.length === 0)
    .filter((round) => typeof round?.roundNumber === 'number' && typeof round.entity?.name === 'string')
    .map((round) => ({ roundNumber: round.roundNumber as number, answer: round.entity!.name as string }))
}
