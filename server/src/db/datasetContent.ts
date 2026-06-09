import { supabase } from './supabase.js'
import { getDataset } from './entities.js'
import { canPurgeDataset } from './maintenance.js'

export interface BulkExportEntity {
  name: string
  type: 'character' | 'place'
  is_published?: boolean
  aliases?: string[]
  clues: Array<{
    text: string
    citations?: string | null
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare' | null
  }>
}

export interface DatasetExportPayload {
  entities: BulkExportEntity[]
}

export class DatasetContentError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'MAINTENANCE_REQUIRED' | 'DATASET_MISMATCH',
    message: string
  ) {
    super(message)
    this.name = 'DatasetContentError'
  }
}

export async function exportDatasetContent(datasetId: string): Promise<DatasetExportPayload> {
  const dataset = await getDataset(datasetId)
  if (!dataset) {
    throw new DatasetContentError('NOT_FOUND', `Dataset ${datasetId} not found`)
  }

  const { data, error } = await supabase
    .from('entities')
    .select('name, type, is_published, aliases, clues(text, citations, difficulty)')
    .eq('dataset_id', datasetId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to export dataset ${datasetId}: ${error.message}`)
  }

  const entities: BulkExportEntity[] = (data ?? []).map((row) => {
    const clues = Array.isArray(row.clues) ? row.clues : []
    return {
      name: row.name as string,
      type: row.type as BulkExportEntity['type'],
      is_published: row.is_published ?? false,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      clues: clues.map((clue: { text: string; citations: string | null; difficulty: string | null }) => ({
        text: clue.text,
        citations: clue.citations,
        difficulty: clue.difficulty as BulkExportEntity['clues'][number]['difficulty']
      }))
    }
  })

  return { entities }
}

export async function purgeDatasetContent(
  datasetId: string,
  options?: { selectedDatasetId?: string | null }
): Promise<{ entitiesDeleted: number }> {
  const dataset = await getDataset(datasetId)
  if (!dataset) {
    throw new DatasetContentError('NOT_FOUND', `Dataset ${datasetId} not found`)
  }

  if (!options?.selectedDatasetId || options.selectedDatasetId !== datasetId) {
    throw new DatasetContentError(
      'DATASET_MISMATCH',
      'Purge is only allowed for the currently selected dataset'
    )
  }

  const allowed = await canPurgeDataset(datasetId)
  if (!allowed) {
    throw new DatasetContentError(
      'MAINTENANCE_REQUIRED',
      'Dataset content can only be purged during an active maintenance window'
    )
  }

  const { count, error: countError } = await supabase
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)

  if (countError) {
    throw new Error(`Failed to count entities for purge: ${countError.message}`)
  }

  const { error: deleteError } = await supabase.from('entities').delete().eq('dataset_id', datasetId)

  if (deleteError) {
    throw new Error(`Failed to purge dataset ${datasetId}: ${deleteError.message}`)
  }

  return { entitiesDeleted: count ?? 0 }
}
