import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import { resolveDatasetIdFromRequest } from '../../db/entities.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const datasetId = await resolveDatasetIdFromRequest(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({
        error: 'NO_DATASET',
        message:
          'No dataset is available. Run `npm run db:create-default-dataset` or pass ?datasetId=.'
      })
    }

    const scopedEntities = () =>
      supabase.from('entities').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId)

    const { count: totalEntities, error: entitiesError } = await scopedEntities()
    if (entitiesError) throw entitiesError

    const { count: unpublishedCount, error: unpublishedError } = await scopedEntities().eq(
      'is_published',
      false
    )
    if (unpublishedError) throw unpublishedError

    const { data: datasetEntityIdsRaw, error: idsError } = await supabase
      .from('entities')
      .select('id, is_published')
      .eq('dataset_id', datasetId)
    if (idsError) throw idsError

    const datasetEntityIds = (datasetEntityIdsRaw ?? []).map((row) => row.id as string)
    const unpublishedIdsForDataset = (datasetEntityIdsRaw ?? [])
      .filter((row) => row.is_published === false)
      .map((row) => row.id as string)

    let totalClues = 0
    let cluesWithoutDifficulty = 0
    const difficulties = ['easy', 'medium', 'hard', 'nightmare'] as const
    const difficultyCounts: Record<(typeof difficulties)[number], number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      nightmare: 0
    }
    let allClueRows: Array<{ entity_id: string }> = []

    if (datasetEntityIds.length > 0) {
      const { count, error } = await supabase
        .from('clues')
        .select('*', { count: 'exact', head: true })
        .in('entity_id', datasetEntityIds)
      if (error) throw error
      totalClues = count ?? 0

      for (const difficulty of difficulties) {
        const { count: diffCount, error: diffError } = await supabase
          .from('clues')
          .select('*', { count: 'exact', head: true })
          .in('entity_id', datasetEntityIds)
          .eq('difficulty', difficulty)
        if (diffError) throw diffError
        difficultyCounts[difficulty] = diffCount ?? 0
      }

      const { count: noDiffCount, error: noDiffError } = await supabase
        .from('clues')
        .select('*', { count: 'exact', head: true })
        .in('entity_id', datasetEntityIds)
        .is('difficulty', null)
      if (noDiffError) throw noDiffError
      cluesWithoutDifficulty = noDiffCount ?? 0

      const { data: clueRows, error: clueRowsError } = await supabase
        .from('clues')
        .select('entity_id')
        .in('entity_id', datasetEntityIds)
      if (clueRowsError) throw clueRowsError
      allClueRows = (clueRows ?? []) as Array<{ entity_id: string }>
    }

    const { count: characterCount, error: charError } = await scopedEntities().eq('type', 'character')
    if (charError) throw charError

    const { count: placeCount, error: placeError } = await scopedEntities().eq('type', 'place')
    if (placeError) throw placeError

    const clueCountByEntity = new Map<string, number>()
    for (const row of allClueRows) {
      clueCountByEntity.set(row.entity_id, (clueCountByEntity.get(row.entity_id) || 0) + 1)
    }
    const readyToPublishCount = unpublishedIdsForDataset.filter(
      (id) => (clueCountByEntity.get(id) || 0) >= 3
    ).length

    const safeTotalEntities = totalEntities ?? 0
    const avgCluesPerEntity =
      safeTotalEntities > 0 ? Math.round((totalClues / safeTotalEntities) * 100) / 100 : 0

    const publishedCount = safeTotalEntities - (unpublishedCount || 0)

    res.json({
      datasetId,
      totalClues,
      totalEntities: safeTotalEntities,
      avgCluesPerEntity,
      unpublishedCount: unpublishedCount || 0,
      publishedCount,
      difficultyCounts,
      cluesWithoutDifficulty,
      entityCountByType: {
        character: characterCount ?? 0,
        place: placeCount ?? 0
      },
      readyToPublishCount
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
