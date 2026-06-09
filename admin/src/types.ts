export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  is_published: boolean
  clueCount?: number
  dataset_id?: string
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
  cluesWithoutDifficulty: number
  entityCountByType: {
    character: number
    place: number
  }
  readyToPublishCount: number
}
