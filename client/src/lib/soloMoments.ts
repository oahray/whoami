import { getActiveDailyStreak, loadDailyProgress } from './dailySolo'
import { listEntityMastery, masteryStage } from './soloMastery'

/** Counts compared before and after a run; a moment fires when a run crosses a milestone. */
export type MomentSnapshot = {
  found: number
  mastered: number
  firstClue: number
  streak: number
}

export function takeMomentSnapshot(datasetId?: string): MomentSnapshot {
  const entities = listEntityMastery(datasetId)
  return {
    found: entities.filter((entity) => entity.correctCount > 0).length,
    mastered: entities.filter(
      (entity) => masteryStage(entity.correctCount, entity.firstClueCorrectCount) === 'mastered'
    ).length,
    firstClue: entities.reduce((sum, entity) => sum + entity.firstClueCorrectCount, 0),
    streak: getActiveDailyStreak(loadDailyProgress())
  }
}

/** Highest milestone in (before, after], from a fixed list and then every `step` past its end. */
export function crossedMilestone(
  before: number,
  after: number,
  fixed: number[],
  step?: number
): number | null {
  if (after <= before) return null
  let crossed: number | null = null
  for (const milestone of fixed) {
    if (milestone > before && milestone <= after) crossed = milestone
  }
  const last = fixed[fixed.length - 1]
  if (step && after > last) {
    const highest = Math.floor((after - last) / step) * step + last
    if (highest > last && highest > before) crossed = highest
  }
  return crossed
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export type Moment = {
  kind: 'streak' | 'perfectDaily' | 'mastered' | 'found' | 'firstClue'
  text: string
}

/** At most one moment per run, picked in priority order. */
export function pickMoment(
  before: MomentSnapshot,
  after: MomentSnapshot,
  opts: { perfectDaily: boolean }
): Moment | null {
  const streak = crossedMilestone(before.streak, after.streak, [7, 30, 60, 100, 365])
  if (streak) return { kind: 'streak', text: `${streak}-day Daily streak!` }
  if (opts.perfectDaily) return { kind: 'perfectDaily', text: 'A perfect Daily: every card right!' }
  const mastered = crossedMilestone(before.mastered, after.mastered, [1, 10, 25, 50], 50)
  if (mastered) {
    return {
      kind: 'mastered',
      text: mastered === 1 ? 'Your first card mastered!' : `${mastered} cards mastered!`
    }
  }
  const found = crossedMilestone(before.found, after.found, [10, 25, 50, 100], 50)
  if (found) return { kind: 'found', text: `${plural(found, 'card', 'cards')} found!` }
  const firstClue = crossedMilestone(before.firstClue, after.firstClue, [10, 25, 50, 100], 100)
  if (firstClue) return { kind: 'firstClue', text: `${firstClue} first-clue solves!` }
  return null
}
