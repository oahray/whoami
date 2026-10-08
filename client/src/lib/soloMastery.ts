const MASTERY_KEY = 'whoami-solo-mastery-v1'

export type MasteryState =
  | 'encountered'
  | 'learning'
  | 'familiar'
  | 'mastered'
  | 'needs_review'

/** Ladder position from how many times the card was answered correctly. */
export type MasteryStage = Exclude<MasteryState, 'needs_review'>

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
  entityId: string
  entityName: string
}

export type MasterySettleCue = {
  state: MasteryState
  label: string
  icon: string
}

const MASTERY_STATUS_UI: Record<MasteryState, { label: string; icon: string }> = {
  encountered: { label: 'Encountered', icon: 'visibility' },
  learning: { label: 'Learning', icon: 'menu_book' },
  familiar: { label: 'Familiar', icon: 'school' },
  mastered: { label: 'Mastered', icon: 'verified' },
  needs_review: { label: 'Needs review', icon: 'replay' }
}

/** Icon + short status for Progress tiles and settle cues. */
export function masteryStatusUi(state: MasteryState): { label: string; icon: string } {
  return MASTERY_STATUS_UI[state]
}

/** Settle cue only when mastery state changes this round. Familiar stays quiet. */
export function masterySettleCue(change: MasteryChange): MasterySettleCue | null {
  if (!change.changed || change.state === 'familiar') return null
  const ui = masteryStatusUi(change.state)
  return { state: change.state, label: ui.label, icon: ui.icon }
}

export type MasterySummary = {
  encountered: number
  mastered: number
  needsReview: number
  firstClueAccuracy: number | null
}

export type MasteryRunDelta = {
  encountered: number
  learning: number
  familiar: number
  mastered: number
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
    const store: MasteryStore = {
      version: 1,
      entities: parsed.entities ?? {},
      appliedEvents: parsed.appliedEvents ?? {}
    }
    return migrateStoredStates(store)
  } catch {
    return emptyStore()
  }
}

/** Rewrite stored states when the ladder changes, so older "mastered" rows land on Familiar. */
function migrateStoredStates(store: MasteryStore): MasteryStore {
  let dirty = false
  const entities = { ...store.entities }
  for (const [entityKey, entity] of Object.entries(entities)) {
    const state = deriveState(
      entity.correctCount,
      entity.firstClueCorrectCount,
      entity.lastCorrect
    )
    if (entity.state === state) continue
    entities[entityKey] = { ...entity, state }
    dirty = true
  }
  const next = dirty ? { ...store, entities } : store
  if (dirty) saveStore(next)
  return next
}

function saveStore(store: MasteryStore): void {
  try {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(store))
  } catch {
    // Progress is device-local; gameplay should continue if storage is unavailable.
  }
}

/** Progress from correct answers. A miss does not erase the ladder. */
export function masteryStage(
  correctCount: number,
  firstClueCorrectCount: number
): MasteryStage {
  if (correctCount >= 5 && firstClueCorrectCount >= 1) return 'mastered'
  if (correctCount >= 3) return 'familiar'
  if (correctCount >= 1) return 'learning'
  return 'encountered'
}

function deriveState(
  correctCount: number,
  firstClueCorrectCount: number,
  lastCorrect: boolean
): MasteryState {
  if (!lastCorrect) return 'needs_review'
  return masteryStage(correctCount, firstClueCorrectCount)
}

/** Keep one change per card for the current run. A later round replaces the earlier one. */
export function recordMasteryChange(
  changes: MasteryChange[] | undefined,
  change: MasteryChange
): MasteryChange[] {
  const next = [...(changes ?? [])]
  const index = next.findIndex((item) => item.entityId === change.entityId)
  if (index >= 0) next[index] = change
  else next.push(change)
  return next
}

/** Cards newly met, and cards that entered Learning, Familiar, or Mastered. */
export function summarizeMasteryRun(changes: MasteryChange[]): MasteryRunDelta {
  const delta: MasteryRunDelta = {
    encountered: 0,
    learning: 0,
    familiar: 0,
    mastered: 0
  }
  for (const change of changes) {
    if (change.previousState === 'new') delta.encountered += 1
    if (!change.changed) continue
    if (
      change.state === 'learning' ||
      change.state === 'familiar' ||
      change.state === 'mastered'
    ) {
      delta[change.state] += 1
    }
  }
  return delta
}

export function formatMasteryRunDelta(delta: MasteryRunDelta): string | null {
  const parts: string[] = []
  if (delta.mastered > 0) parts.push(`+${delta.mastered} mastered`)
  if (delta.familiar > 0) parts.push(`+${delta.familiar} familiar`)
  if (delta.learning > 0) parts.push(`+${delta.learning} learning`)
  if (delta.encountered > 0) parts.push(`+${delta.encountered} encountered`)
  return parts.length > 0 ? parts.join(' · ') : null
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
      entityId: existing.entityId,
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
    entityId: outcome.entityId,
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
    mastered: entities.filter(
      (entity) => masteryStage(entity.correctCount, entity.firstClueCorrectCount) === 'mastered'
    ).length,
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

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * After a content reimport, entity ids change but names usually stay.
 * Remap local mastery onto the current catalog by id, then by name; drop the rest.
 */
export function rekeyMasteryToCatalog(
  datasetId: string,
  catalog: Array<{ id: string; name: string }>
): { remapped: number; removed: number } {
  const store = loadStore()
  const byId = new Map(catalog.map((entity) => [entity.id, entity]))
  const byName = new Map<string, { id: string; name: string }>()
  for (const entity of catalog) {
    const normalized = normalizeEntityName(entity.name)
    if (normalized && !byName.has(normalized)) byName.set(normalized, entity)
  }

  let remapped = 0
  let removed = 0
  const nextEntities: Record<string, EntityMastery> = {}
  const retiredIds = new Set<string>()

  for (const [entityKey, entity] of Object.entries(store.entities)) {
    if (entity.datasetId !== datasetId) {
      nextEntities[entityKey] = entity
      continue
    }

    if (byId.has(entity.entityId)) {
      nextEntities[entityKey] = entity
      continue
    }

    const match = byName.get(normalizeEntityName(entity.entityName))
    if (match) {
      const nextKey = key(datasetId, match.id)
      const existing = nextEntities[nextKey]
      // Prefer the richer of two rows if both remap onto the same new id.
      const candidate: EntityMastery = {
        ...entity,
        entityId: match.id,
        entityName: match.name
      }
      if (
        !existing ||
        candidate.encounters > existing.encounters ||
        (candidate.encounters === existing.encounters &&
          candidate.correctCount >= existing.correctCount)
      ) {
        nextEntities[nextKey] = candidate
      }
      retiredIds.add(entity.entityId)
      remapped += 1
      continue
    }

    retiredIds.add(entity.entityId)
    removed += 1
  }

  const nextEvents: Record<string, true> = {}
  for (const [eventId, value] of Object.entries(store.appliedEvents)) {
    if (!eventId.startsWith(`${datasetId}:`)) {
      nextEvents[eventId] = value
      continue
    }
    const rest = eventId.slice(datasetId.length + 1)
    const entityId = rest.split(':')[0] ?? ''
    if (retiredIds.has(entityId)) continue
    nextEvents[eventId] = value
  }

  if (remapped > 0 || removed > 0) {
    saveStore({ version: 1, entities: nextEntities, appliedEvents: nextEvents })
  }
  return { remapped, removed }
}

/**
 * Apply Review resolve results: remap stale ids onto current catalog ids,
 * and drop requested ids that the server could not resolve.
 */
export function applyResolveRemaps(
  datasetId: string,
  resolved: Array<{ id: string; name: string; previousId: string }>,
  requestedIds: string[]
): { remapped: number; removed: number } {
  const store = loadStore()
  const nextEntities: Record<string, EntityMastery> = { ...store.entities }
  const retiredIds = new Set<string>()
  let remapped = 0
  let removed = 0

  const resolvedPrevious = new Set(resolved.map((entry) => entry.previousId))
  for (const previousId of requestedIds) {
    if (resolvedPrevious.has(previousId)) continue
    const entityKey = key(datasetId, previousId)
    if (nextEntities[entityKey]) {
      delete nextEntities[entityKey]
      retiredIds.add(previousId)
      removed += 1
    }
  }

  for (const entry of resolved) {
    if (entry.previousId === entry.id) {
      const entityKey = key(datasetId, entry.id)
      const entity = nextEntities[entityKey]
      if (entity && entity.entityName !== entry.name) {
        nextEntities[entityKey] = { ...entity, entityName: entry.name }
      }
      continue
    }

    const fromKey = key(datasetId, entry.previousId)
    const entity = nextEntities[fromKey]
    if (!entity) continue

    const toKey = key(datasetId, entry.id)
    const candidate: EntityMastery = {
      ...entity,
      entityId: entry.id,
      entityName: entry.name
    }
    const existing = nextEntities[toKey]
    if (
      !existing ||
      candidate.encounters > existing.encounters ||
      (candidate.encounters === existing.encounters &&
        candidate.correctCount >= existing.correctCount)
    ) {
      nextEntities[toKey] = candidate
    }
    delete nextEntities[fromKey]
    retiredIds.add(entry.previousId)
    remapped += 1
  }

  if (remapped === 0 && removed === 0) {
    return { remapped: 0, removed: 0 }
  }

  const nextEvents: Record<string, true> = {}
  for (const [eventId, value] of Object.entries(store.appliedEvents)) {
    if (!eventId.startsWith(`${datasetId}:`)) {
      nextEvents[eventId] = value
      continue
    }
    const rest = eventId.slice(datasetId.length + 1)
    const entityId = rest.split(':')[0] ?? ''
    if (retiredIds.has(entityId)) continue
    nextEvents[eventId] = value
  }

  saveStore({ version: 1, entities: nextEntities, appliedEvents: nextEvents })
  return { remapped, removed }
}
