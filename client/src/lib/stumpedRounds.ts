export type StumpedRound = { roundNumber: number; answer: string }

const MAX_NAMED = 3

/** "Round 3 (Amnon) stumped everyone." or null when every round was solved. */
export function stumpedRoundsLine(rounds: StumpedRound[] | undefined | null): string | null {
  if (!Array.isArray(rounds) || rounds.length === 0) return null
  if (rounds.length > MAX_NAMED) return `${rounds.length} rounds stumped everyone.`
  // Non-breaking space keeps "round 3" on one line.
  const named = rounds.map((round) => `${round.answer} (round\u00a0${round.roundNumber})`)
  if (named.length === 1) {
    const [round] = rounds
    return `Round ${round.roundNumber} (${round.answer}) stumped everyone.`
  }
  const list = `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
  return `${list} stumped everyone.`
}
