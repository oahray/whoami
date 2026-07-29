import { API_BASE_URL } from './apiBase'
import {
  coerceDifficultySelection,
  difficultySelectionEquals,
  encodeDifficultySelection,
  type DifficultySelection
} from './difficultySelection'
import { DEFAULT_ENTITY_TYPE_FILTER, type EntityTypeFilter } from './entityTypeFilter'
import type { InPersonCard } from '../types'

export const IN_PERSON_DECK_SIZE = 10

export type InPersonCardSnapshot = {
  card: InPersonCard
  revealedCount: number
  showAnswer: boolean
}

export type InPersonDeckSession = {
  datasetId: string
  difficulty: DifficultySelection
  entityType: EntityTypeFilter
  masterPool: string[]
  deckStartOffset: number
  index: number
  history: InPersonCardSnapshot[]
}

const STORAGE_KEY = 'whoami-in-person-deck'

export function saveDeckSession(session: InPersonDeckSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function isValidSession(raw: unknown): raw is InPersonDeckSession {
  if (!raw || typeof raw !== 'object') return false
  const session = raw as Partial<InPersonDeckSession>
  return (
    typeof session.datasetId === 'string' &&
    session.difficulty != null &&
    Array.isArray(session.masterPool) &&
    typeof session.deckStartOffset === 'number' &&
    typeof session.index === 'number' &&
    Array.isArray(session.history)
  )
}

export function loadDeckSession(
  datasetId: string,
  difficulty: DifficultySelection | string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): InPersonDeckSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSession(parsed)) return null
    const sessionEntityType = parsed.entityType ?? DEFAULT_ENTITY_TYPE_FILTER
    const sessionDifficulty = coerceDifficultySelection(parsed.difficulty)
    const wantedDifficulty = coerceDifficultySelection(difficulty)
    if (
      parsed.datasetId !== datasetId ||
      !difficultySelectionEquals(sessionDifficulty, wantedDifficulty) ||
      sessionEntityType !== entityType
    ) {
      return null
    }
    return { ...parsed, difficulty: sessionDifficulty, entityType: sessionEntityType }
  } catch {
    return null
  }
}

export function clearDeckSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function currentDeckEntityIds(session: InPersonDeckSession): string[] {
  return session.masterPool.slice(
    session.deckStartOffset,
    session.deckStartOffset + IN_PERSON_DECK_SIZE
  )
}

export function currentEntityId(session: InPersonDeckSession): string | null {
  const deck = currentDeckEntityIds(session)
  if (session.index < 0 || session.index >= deck.length) return null
  return deck[session.index] ?? null
}

export function isDeckExhausted(session: InPersonDeckSession): boolean {
  return session.index >= currentDeckEntityIds(session).length
}

export function isSessionComplete(session: InPersonDeckSession): boolean {
  const deck = currentDeckEntityIds(session)
  return (
    isDeckExhausted(session) &&
    session.deckStartOffset + deck.length >= session.masterPool.length
  )
}

export function hasNextDeck(session: InPersonDeckSession): boolean {
  if (!isDeckExhausted(session)) return false
  const deck = currentDeckEntityIds(session)
  return session.deckStartOffset + deck.length < session.masterPool.length
}

export function remainingEntityCount(session: InPersonDeckSession): number {
  const deck = currentDeckEntityIds(session)
  const consumedThroughCurrentDeck = session.deckStartOffset + deck.length
  return Math.max(0, session.masterPool.length - consumedThroughCurrentDeck)
}

export function totalDeckCount(session: InPersonDeckSession): number {
  return Math.ceil(session.masterPool.length / IN_PERSON_DECK_SIZE)
}

export function currentDeckNumber(session: InPersonDeckSession): number {
  return Math.floor(session.deckStartOffset / IN_PERSON_DECK_SIZE) + 1
}

export function deckProgressLabel(session: InPersonDeckSession): string {
  const deck = currentDeckEntityIds(session)
  const totalDecks = totalDeckCount(session)
  const deckNumber = currentDeckNumber(session)
  const current = Math.min(session.index + 1, deck.length)
  return `Card ${current} of ${deck.length} · Deck ${deckNumber} of ${totalDecks}`
}

export function snapshotForIndex(
  session: InPersonDeckSession,
  index: number
): InPersonCardSnapshot | null {
  return session.history[index] ?? null
}

export function updateCardSnapshot(
  session: InPersonDeckSession,
  snapshot: InPersonCardSnapshot
): InPersonDeckSession {
  const history = [...session.history]
  history[session.index] = snapshot
  return { ...session, history }
}

export function advanceToNextDeck(session: InPersonDeckSession): InPersonDeckSession {
  const currentDeck = currentDeckEntityIds(session)
  return {
    ...session,
    deckStartOffset: session.deckStartOffset + currentDeck.length,
    index: 0,
    history: []
  }
}

export async function fetchInPersonDeck(
  datasetId: string,
  difficulty: DifficultySelection | string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): Promise<InPersonDeckSession> {
  const selection = coerceDifficultySelection(difficulty)
  const params = new URLSearchParams({
    datasetId,
    difficulty: encodeDifficultySelection(selection),
    entityType
  })
  const res = await fetch(`${API_BASE_URL}/cards/deck?${params.toString()}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load deck (${res.status})`)
  }
  const { entityIds } = (await res.json()) as { entityIds: string[] }
  const session: InPersonDeckSession = {
    datasetId,
    difficulty: selection,
    entityType,
    masterPool: entityIds,
    deckStartOffset: 0,
    index: 0,
    history: []
  }
  saveDeckSession(session)
  return session
}
