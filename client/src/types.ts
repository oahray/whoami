export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  is_published: boolean
  clueCount?: number
  /** Owning dataset; required at the DB level. */
  dataset_id?: string
  /** Alternate names accepted during guess matching. */
  aliases?: string[]
  created_at?: string
  updated_at?: string
}

export interface Dataset {
  id: string
  name: string
  source: string | null
  description: string | null
  is_official: boolean
  is_enabled: boolean
  is_default: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Public dataset metadata returned by the unauthenticated GET /datasets endpoint.
 * Used by the lobby picker; intentionally narrower than Dataset to avoid leaking
 * internal flags (is_official, is_enabled) to anonymous players.
 */
export interface PublicDataset {
  id: string
  name: string
  source: string | null
  description: string | null
  is_default: boolean
}

export interface Clue {
  id: string
  entity_id: string
  text: string
  citations: string | null
  difficulty: Difficulty | null
  created_at?: string
  updated_at?: string
}

export interface Stats {
  /** Echoed dataset id the stats are scoped to. */
  datasetId?: string
  totalEntities: number
  totalClues: number
  avgCluesPerEntity: number
  unpublishedCount: number
  publishedCount: number
  difficultyCounts: {
    easy: number
    medium: number
    hard: number
    nightmare: number
  }
  /** Clues with no difficulty set (need tagging) */
  cluesWithoutDifficulty: number
  entityCountByType: {
    character: number
    place: number
  }
  /** Unpublished entities that have 3+ clues and can be published */
  readyToPublishCount: number
}
