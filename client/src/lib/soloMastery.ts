const MASTERY_KEY = 'whoami-solo-mastery-v1'

export type MasteryState = 'learning' | 'mastered' | 'needs_review'

export type EntityMastery = {
  datasetId: string
  entityId: string
  entityName: string
  encounters: number
  correctCount: number
  firstClueCorrectCount: number
  missCount: number
  lastCorrect: boolean
  lastEncounteredAt: string
  state: MasteryState
}

type MasteryStore = {
  version: 1
  entities: Record<string, EntityMastery>
  appliedEvents: Record<string, true>
}

export type MasteryOutcome = {
  eventId: string
  datasetId: string
  entityId: string
  entityName: string
  correct: boolean
  revealedClueCount: number
  settledAt?: string
}

export type MasteryChange = {
  state: MasteryState
  previousState: MasteryState | 'new'
  changed: boolean
  entityName: string
}

export type MasterySettleCue = {
  state: MasteryState
  label: string
  icon: string
}

const MASTERY_STATUS_UI: Record<MasteryState, { label: string; icon: string }> = {
  learning: { label: 'Learning', icon: 'menu_book' },
  needs_review: { label: 'Needs review', icon: 'replay' },
  mastered: { label: 'Mastered', icon: 'verified' }
}

/** Icon + short status for Progress tiles and settle cues. */
export function masteryStatusUi(state: MasteryState): { label: string; icon: string } {
  return MASTERY_STATUS_UI[state]
}

/** Settle cue only when mastery state changes this round. */
export function masterySettleCue(change: MasteryChange): MasterySettleCue | null {
  if (!change.changed) return null
  const ui = masteryStatusUi(change.state)
  return { state: change.state, label: ui.label, icon: ui.icon }
}

export type MasterySummary = {
  encountered: number
  mastered: number
  needsReview: number
  firstClueAccuracy: number | null
}

function emptyStore(): MasteryStore {
  return { version: 1, entities: {}, appliedEvents: {} }
}

function key(datasetId: string, entityId: string): string {
  return `${datasetId}:${entityId}`
}

function loadStore(): MasteryStore {
  try {
    const raw = localStorage.getItem(MASTERY_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<MasteryStore>
    if (parsed.version !== 1) return emptyStore()
    return {
      version: 1,
      entities: parsed.entities ?? {},
      appliedEvents: parsed.appliedEvents ?? {}
    }
  } catch {
    return emptyStore()
  }
}

function saveStore(store: MasteryStore): void {
  try {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(store))
  } catch {
    // Progress is device-local; gameplay should continue if storage is unavailable.
  }
}

function deriveState(
  correctCount: number,
  firstClueCorrectCount: number,
  lastCorrect: boolean
): MasteryState {
  if (!lastCorrect) return 'needs_review'
  if (correctCount >= 3 && firstClueCorrectCount >= 1) return 'mastered'
  return 'learning'
}

/** Idempotently apply one settled Solo round to device-local mastery. */
export function applyMasteryOutcome(outcome: MasteryOutcome): MasteryChange {
  const store = loadStore()
  const existing = store.entities[key(outcome.datasetId, outcome.entityId)]
  const previousState = existing?.state ?? 'new'

  if (store.appliedEvents[outcome.eventId] && existing) {
    return {
      state: existing.state,
      previousState: existing.state,
      changed: false,
      entityName: existing.entityName
    }
  }

  const correctCount = (existing?.correctCount ?? 0) + (outcome.correct ? 1 : 0)
  const firstClueCorrectCount =
    (existing?.firstClueCorrectCount ?? 0) +
    (outcome.correct && outcome.revealedClueCount === 1 ? 1 : 0)
  const state = deriveState(correctCount, firstClueCorrectCount, outcome.correct)
  const next: EntityMastery = {
    datasetId: outcome.datasetId,
    entityId: outcome.entityId,
    entityName: outcome.entityName,
    encounters: (existing?.encounters ?? 0) + 1,
    correctCount,
    firstClueCorrectCount,
    missCount: (existing?.missCount ?? 0) + (outcome.correct ? 0 : 1),
    lastCorrect: outcome.correct,
    lastEncounteredAt: outcome.settledAt ?? new Date().toISOString(),
    state
  }

  store.entities[key(outcome.datasetId, outcome.entityId)] = next
  store.appliedEvents[outcome.eventId] = true
  saveStore(store)
  return {
    state,
    previousState,
    changed: state !== previousState,
    entityName: outcome.entityName
  }
}

export function listEntityMastery(datasetId?: string): EntityMastery[] {
  return Object.values(loadStore().entities)
    .filter((entity) => (datasetId ? entity.datasetId === datasetId : true))
    .sort((left, right) => right.lastEncounteredAt.localeCompare(left.lastEncounteredAt))
}

export function getNeedsReviewEntityIds(datasetId: string): string[] {
  return listEntityMastery(datasetId)
    .filter((entity) => entity.state === 'needs_review')
    .map((entity) => entity.entityId)
}

export function getMasterySummary(datasetId?: string): MasterySummary {
  const entities = listEntityMastery(datasetId)
  const correct = entities.reduce((sum, entity) => sum + entity.correctCount, 0)
  const firstClue = entities.reduce(
    (sum, entity) => sum + entity.firstClueCorrectCount,
    0
  )
  return {
    encountered: entities.length,
    mastered: entities.filter((entity) => entity.state === 'mastered').length,
    needsReview: entities.filter((entity) => entity.state === 'needs_review').length,
    firstClueAccuracy: correct > 0 ? firstClue / correct : null
  }
}

/** Clear learning progress for one dataset (encounters, mastery, review). */
export function clearMasteryForDataset(datasetId: string): void {
  const store = loadStore()
  const nextEntities: Record<string, EntityMastery> = {}
  for (const [entityKey, entity] of Object.entries(store.entities)) {
    if (entity.datasetId !== datasetId) nextEntities[entityKey] = entity
  }
  const nextEvents: Record<string, true> = {}
  for (const eventId of Object.keys(store.appliedEvents)) {
    // Event ids are `${datasetId}:${entityId}:${startedAt}`.
    if (!eventId.startsWith(`${datasetId}:`)) nextEvents[eventId] = true
  }
  saveStore({ version: 1, entities: nextEntities, appliedEvents: nextEvents })
}
