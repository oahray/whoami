import { API_BASE_URL } from './apiBase'
import type { GameDifficultyMode } from '../types'

export type InPersonDeckSession = {
  datasetId: string
  difficulty: GameDifficultyMode
  entityIds: string[]
  index: number
}

const STORAGE_KEY = 'whoami-in-person-deck'

export function saveDeckSession(session: InPersonDeckSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadDeckSession(
  datasetId: string,
  difficulty: GameDifficultyMode
): InPersonDeckSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as InPersonDeckSession
    if (session.datasetId !== datasetId || session.difficulty !== difficulty) {
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearDeckSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function currentEntityId(session: InPersonDeckSession): string | null {
  if (session.index < 0 || session.index >= session.entityIds.length) return null
  return session.entityIds[session.index] ?? null
}

export function isDeckExhausted(session: InPersonDeckSession): boolean {
  return session.index >= session.entityIds.length
}

export function deckProgressLabel(session: InPersonDeckSession): string {
  const total = session.entityIds.length
  const current = Math.min(session.index + 1, total)
  return `Card ${current} of ${total}`
}

export async function fetchInPersonDeck(
  datasetId: string,
  difficulty: GameDifficultyMode
): Promise<InPersonDeckSession> {
  const params = new URLSearchParams({ datasetId, difficulty })
  const res = await fetch(`${API_BASE_URL}/cards/deck?${params.toString()}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load deck (${res.status})`)
  }
  const { entityIds } = (await res.json()) as { entityIds: string[] }
  const session: InPersonDeckSession = {
    datasetId,
    difficulty,
    entityIds,
    index: 0
  }
  saveDeckSession(session)
  return session
}
