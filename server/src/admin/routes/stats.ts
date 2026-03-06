import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const { count: totalEntities, error: entitiesError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })

    if (entitiesError) throw entitiesError

    const { count: unpublishedCount, error: unpublishedError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', false)

    if (unpublishedError) throw unpublishedError

    // Overall clue count
    const { count: totalClues, error: cluesError } = await supabase
      .from('clues')
      .select('*', { count: 'exact', head: true })

    if (cluesError) throw cluesError

    // Clue counts by difficulty for dashboard difficulty stats
    const difficulties = ['easy', 'medium', 'hard', 'nightmare'] as const
    const difficultyCounts: Record<(typeof difficulties)[number], number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      nightmare: 0
    }

    for (const difficulty of difficulties) {
      const { count, error } = await supabase
        .from('clues')
        .select('*', { count: 'exact', head: true })
        .eq('difficulty', difficulty)

      if (error) throw error
      difficultyCounts[difficulty] = count || 0
    }

    // Clues without difficulty set (need tagging)
    const { count: cluesWithoutDifficulty, error: noDiffError } = await supabase
      .from('clues')
      .select('*', { count: 'exact', head: true })
      .is('difficulty', null)

    if (noDiffError) throw noDiffError

    // Entities by type
    const { count: characterCount, error: charError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'character')
    if (charError) throw charError

    const { count: placeCount, error: placeError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'place')
    if (placeError) throw placeError

    // Unpublished entities that have 3+ clues (ready to publish)
    const { data: unpublishedIds } = await supabase
      .from('entities')
      .select('id')
      .eq('is_published', false)
    const { data: clueRows } = await supabase
      .from('clues')
      .select('entity_id')

    const clueCountByEntity = new Map<string, number>()
    for (const row of clueRows || []) {
      const id = (row as { entity_id: string }).entity_id
      clueCountByEntity.set(id, (clueCountByEntity.get(id) || 0) + 1)
    }
    const readyToPublishCount = (unpublishedIds || []).filter(
      (e) => (clueCountByEntity.get(e.id) || 0) >= 3
    ).length

    const safeTotalEntities = totalEntities ?? 0
    const safeTotalClues = totalClues ?? 0

    const avgCluesPerEntity = safeTotalEntities > 0
      ? Math.round((safeTotalClues / safeTotalEntities) * 100) / 100
      : 0

    const publishedCount = safeTotalEntities - (unpublishedCount || 0)

    res.json({
      totalClues: safeTotalClues,
      totalEntities: safeTotalEntities,
      avgCluesPerEntity,
      unpublishedCount: unpublishedCount || 0,
      publishedCount,
      difficultyCounts,
      cluesWithoutDifficulty: cluesWithoutDifficulty ?? 0,
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
