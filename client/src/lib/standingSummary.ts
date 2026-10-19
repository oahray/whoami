export type RankedEntry = {
  playerId: string
  nickname: string
  score: number
  rank: number
  tied: boolean
}

const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`

/**
 * One-line live standing for the collapsed mobile scoreboard: who leads and by
 * how much, relative to you. `ranked` must already be sorted with competition ranks.
 */
export function standingSummary(ranked: RankedEntry[], playerId: string | null): string {
  if (ranked.length === 0) return 'No players yet'
  const leaders = ranked.filter((entry) => entry.rank === 1)
  const top = leaders[0].score
  if (top <= 0) return 'No one has scored yet'

  const you = ranked.find((entry) => entry.playerId === playerId)
  if (!you) {
    return leaders.length > 1
      ? `${leaders.length} players tied for the lead · ${pts(top)}`
      : `${leaders[0].nickname} leads with ${pts(top)}`
  }

  if (you.rank === 1) {
    if (leaders.length > 1) return `You're tied for the lead · ${pts(you.score)}`
    const runnerUp = ranked.find((entry) => entry.rank > 1)
    const gap = runnerUp ? top - runnerUp.score : top
    return `You lead by ${gap} · ${pts(you.score)}`
  }

  const behind = top - you.score
  const who = leaders.length > 1 ? 'the leaders' : leaders[0].nickname
  return `${behind} behind ${who} · You're #${you.rank}${you.tied ? ' (tied)' : ''}`
}
