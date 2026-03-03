import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const { data: publishedByDifficulty, error: publishedError } = await supabase
      .from('entities')
      .select('difficulty, is_published')
      .eq('is_published', true)

    if (publishedError) throw publishedError

    const publishedCount: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      nightmare: 0
    }

    publishedByDifficulty?.forEach(entity => {
      publishedCount[entity.difficulty] = (publishedCount[entity.difficulty] || 0) + 1
    })

    const { count: totalClues, error: cluesError } = await supabase
      .from('clues')
      .select('*', { count: 'exact', head: true })

    if (cluesError) throw cluesError

    const { count: totalEntities, error: entitiesError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })

    if (entitiesError) throw entitiesError

    const { count: unpublishedCount, error: unpublishedError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', false)

    if (unpublishedError) throw unpublishedError

    const safeTotalEntities = totalEntities ?? 0
    const safeTotalClues = totalClues ?? 0

    const avgCluesPerEntity = safeTotalEntities > 0
      ? Math.round((safeTotalClues / safeTotalEntities) * 100) / 100
      : 0

    res.json({
      publishedCount,
      totalClues: safeTotalClues,
      totalEntities: safeTotalEntities,
      avgCluesPerEntity,
      unpublishedCount: unpublishedCount || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
