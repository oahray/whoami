import { supabase } from './supabase.js'
import { getDataset } from './entities.js'
import { canPurgeDataset } from './maintenance.js'
import { fetchAllPages } from './fetchAllPages.js'

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

export type PurgeMode = 'clues' | 'all'

export type PurgeDatasetResult =
  | { mode: 'clues'; cluesDeleted: number; entitiesUnpublished: number }
  | { mode: 'all'; entitiesDeleted: number }

export class DatasetContentError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'MAINTENANCE_REQUIRED' | 'DATASET_MISMATCH' | 'INVALID_MODE',
    message: string
  ) {
    super(message)
    this.name = 'DatasetContentError'
  }
}

const ENTITY_ID_CHUNK = 100

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

export function parsePurgeMode(raw: unknown): PurgeMode {
  if (raw == null || raw === '') return 'clues'
  if (raw === 'clues' || raw === 'all') return raw
  throw new DatasetContentError('INVALID_MODE', 'Purge mode must be "clues" or "all"')
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

async function assertPurgeAllowed(
  datasetId: string,
  options?: { selectedDatasetId?: string | null }
) {
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
}

async function purgeCluesOnly(datasetId: string): Promise<Extract<PurgeDatasetResult, { mode: 'clues' }>> {
  const entityRows = await fetchAllPages<{ id: string }>((from, to) =>
    supabase
      .from('entities')
      .select('id')
      .eq('dataset_id', datasetId)
      .order('id')
      .range(from, to)
  )
  const entityIds = entityRows.map((row) => row.id)
  if (entityIds.length === 0) {
    return { mode: 'clues', cluesDeleted: 0, entitiesUnpublished: 0 }
  }

  let cluesDeleted = 0
  for (const chunk of chunkIds(entityIds, ENTITY_ID_CHUNK)) {
    const { count, error: countError } = await supabase
      .from('clues')
      .select('id', { count: 'exact', head: true })
      .in('entity_id', chunk)
    if (countError) {
      throw new Error(`Failed to count clues for purge: ${countError.message}`)
    }
    cluesDeleted += count ?? 0

    const { error: deleteError } = await supabase.from('clues').delete().in('entity_id', chunk)
    if (deleteError) {
      throw new Error(`Failed to purge clues for dataset ${datasetId}: ${deleteError.message}`)
    }
  }

  const { data: unpublishedRows, error: unpublishError } = await supabase
    .from('entities')
    .update({ is_published: false })
    .eq('dataset_id', datasetId)
    .eq('is_published', true)
    .select('id')

  if (unpublishError) {
    throw new Error(`Failed to unpublish entities after clues purge: ${unpublishError.message}`)
  }

  return {
    mode: 'clues',
    cluesDeleted,
    entitiesUnpublished: unpublishedRows?.length ?? 0
  }
}

async function purgeAllContent(datasetId: string): Promise<Extract<PurgeDatasetResult, { mode: 'all' }>> {
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

  return { mode: 'all', entitiesDeleted: count ?? 0 }
}

/**
 * Purge dataset content during an active maintenance window.
 * - `clues` (default): delete all clues, keep entity rows (stable ids), unpublish.
 * - `all`: delete every entity (+ cascaded clues); nuclear wipe.
 */
export async function purgeDatasetContent(
  datasetId: string,
  options?: { selectedDatasetId?: string | null; mode?: PurgeMode | unknown }
): Promise<PurgeDatasetResult> {
  const mode = parsePurgeMode(options?.mode)
  await assertPurgeAllowed(datasetId, options)

  if (mode === 'clues') {
    return purgeCluesOnly(datasetId)
  }
  return purgeAllContent(datasetId)
}
