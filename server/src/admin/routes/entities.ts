import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import { resolveDatasetIdFromRequest } from '../../db/entities.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

async function requireDatasetId(
  res: Response,
  raw: unknown
): Promise<string | null> {
  const datasetId = await resolveDatasetIdFromRequest(raw)
  if (!datasetId) {
    res.status(400).json({
      error: 'NO_DATASET',
      message:
        'No dataset is available. Run `npm run db:create-default-dataset` or pass datasetId.'
    })
    return null
  }
  return datasetId
}

router.get('/entities', async (req: AuthRequest, res: Response) => {
  try {
    const datasetId = await requireDatasetId(res, req.query.datasetId)
    if (!datasetId) return

    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('name')

    if (entitiesError) throw entitiesError

    const entitiesWithClueCount = await Promise.all(
      (entities ?? []).map(async (entity) => {
        const { count, error: countError } = await supabase
          .from('clues')
          .select('*', { count: 'exact', head: true })
          .eq('entity_id', entity.id)

        if (countError) throw countError

        return {
          ...entity,
          clueCount: count || 0
        }
      })
    )

    res.json(entitiesWithClueCount)
  } catch (error) {
    console.error('Error fetching entities:', error)
    res.status(500).json({ error: 'Failed to fetch entities' })
  }
})

router.get('/entities/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    console.error('Error fetching entity:', error)
    res.status(500).json({ error: 'Failed to fetch entity' })
  }
})

router.post('/entities', async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, is_published, aliases } = req.body

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields: name, type' })
    }

    const datasetId = await requireDatasetId(res, req.body?.datasetId ?? req.query.datasetId)
    if (!datasetId) return

    const { data, error } = await supabase
      .from('entities')
      .insert({
        name,
        type,
        is_published: is_published || false,
        dataset_id: datasetId,
        aliases: Array.isArray(aliases) ? aliases : []
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating entity:', error)
    res.status(500).json({ error: 'Failed to create entity' })
  }
})

router.put('/entities/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, type, is_published, aliases } = req.body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (Array.isArray(aliases)) updateData.aliases = aliases

    if (is_published !== undefined) {
      if (is_published) {
        const { count, error: countError } = await supabase
          .from('clues')
          .select('*', { count: 'exact', head: true })
          .eq('entity_id', id)

        if (countError) throw countError

        updateData.is_published = (count || 0) >= 3
      } else {
        updateData.is_published = false
      }
    }

    const { data, error } = await supabase
      .from('entities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    console.error('Error updating entity:', error)
    res.status(500).json({ error: 'Failed to update entity' })
  }
})

router.delete('/entities/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('is_published, dataset_id')
      .eq('id', id)
      .single()

    if (entityError) throw entityError

    if (entity.is_published) {
      const { error: unpublishError } = await supabase
        .from('entities')
        .update({ is_published: false })
        .eq('id', id)

      if (unpublishError) throw unpublishError
    }

    let publishedCountQuery = supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)

    if (entity.dataset_id) {
      publishedCountQuery = publishedCountQuery.eq('dataset_id', entity.dataset_id)
    }

    const { count: publishedCount, error: countError } = await publishedCountQuery

    if (countError) throw countError

    if (publishedCount === 0) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_LAST_PUBLISHED',
        message: 'Cannot delete the last published entity in this dataset'
      })
    }

    const { error: deleteError } = await supabase
      .from('entities')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting entity:', error)
    res.status(500).json({ error: 'Failed to delete entity' })
  }
})

export default router
