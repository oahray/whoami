export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  is_published: boolean
  clueCount?: number
  created_at?: string
  updated_at?: string
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
