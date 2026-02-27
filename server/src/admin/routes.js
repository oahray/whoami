import express from 'express'
import { adminAuth } from './auth.js'
import { supabase } from '../db/supabase.js'

const router = express.Router()

// All admin routes require authentication
router.use(adminAuth)

/**
 * GET /admin/entities
 * List all entities with clue count and published status
 */
router.get('/entities', async (req, res) => {
  try {
    // Get all entities
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('*')
      .order('name')

    if (entitiesError) throw entitiesError

    // Get clue counts for each entity
    const entitiesWithClueCount = await Promise.all(
      entities.map(async (entity) => {
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

/**
 * GET /admin/entities/:id
 * Get a single entity
 */
router.get('/entities/:id', async (req, res) => {
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

/**
 * POST /admin/entities
 * Create a new entity
 */
router.post('/entities', async (req, res) => {
  try {
    const { name, type, difficulty, is_published } = req.body

    if (!name || !type || !difficulty) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { data, error } = await supabase
      .from('entities')
      .insert({
        name,
        type,
        difficulty,
        is_published: is_published || false
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

/**
 * PUT /admin/entities/:id
 * Update entity fields
 */
router.put('/entities/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, type, difficulty, is_published } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (difficulty !== undefined) updateData.difficulty = difficulty
    if (is_published !== undefined) {
      // Check if entity has at least 3 clues before publishing
      if (is_published) {
        const { count, error: countError } = await supabase
          .from('clues')
          .select('*', { count: 'exact', head: true })
          .eq('entity_id', id)

        if (countError) throw countError

        if ((count || 0) < 3) {
          return res.status(400).json({
            error: 'INSUFFICIENT_CLUES',
            message: 'Entity must have at least 3 clues before publishing'
          })
        }
      }
      updateData.is_published = is_published
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

/**
 * DELETE /admin/entities/:id
 * Delete entity (unpublishes first if published)
 */
router.delete('/entities/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if entity is published
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('is_published')
      .eq('id', id)
      .single()

    if (entityError) throw entityError

    // If published, unpublish first
    if (entity.is_published) {
      const { error: unpublishError } = await supabase
        .from('entities')
        .update({ is_published: false })
        .eq('id', id)

      if (unpublishError) throw unpublishError
    }

    // Check if this is the only published entity (guard)
    const { count: publishedCount, error: countError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)

    if (countError) throw countError

    if (publishedCount === 0) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_LAST_PUBLISHED',
        message: 'Cannot delete the last published entity'
      })
    }

    // Delete entity (cascade will delete clues)
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

/**
 * GET /admin/entities/:id/clues
 * Get all clues for an entity (ordered)
 */
router.get('/entities/:id/clues', async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('clues')
      .select('*')
      .eq('entity_id', id)
      .order('order', { ascending: true })

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    console.error('Error fetching clues:', error)
    res.status(500).json({ error: 'Failed to fetch clues' })
  }
})

/**
 * POST /admin/entities/:id/clues
 * Add a clue to an entity
 */
router.post('/entities/:id/clues', async (req, res) => {
  try {
    const { id } = req.params
    const { text, citations, difficulty, order } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Clue text is required' })
    }

    // If order not provided, get next order number
    let clueOrder = order
    if (clueOrder === undefined) {
      const { count, error: countError } = await supabase
        .from('clues')
        .select('*', { count: 'exact', head: true })
        .eq('entity_id', id)

      if (countError) throw countError
      clueOrder = (count || 0) + 1
    }

    const { data, error } = await supabase
      .from('clues')
      .insert({
        entity_id: id,
        text,
        citations: citations || null,
        difficulty: difficulty || null,
        order: clueOrder
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating clue:', error)
    res.status(500).json({ error: 'Failed to create clue' })
  }
})

/**
 * PUT /admin/clues/:id
 * Update clue text, citations, difficulty, or order
 */
router.put('/clues/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { text, citations, difficulty, order } = req.body

    const updateData = {}
    if (text !== undefined) updateData.text = text
    if (citations !== undefined) updateData.citations = citations
    if (difficulty !== undefined) updateData.difficulty = difficulty
    if (order !== undefined) updateData.order = order

    const { data, error } = await supabase
      .from('clues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    console.error('Error updating clue:', error)
    res.status(500).json({ error: 'Failed to update clue' })
  }
})

/**
 * DELETE /admin/clues/:id
 * Delete a clue
 */
router.delete('/clues/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get entity_id before deleting
    const { data: clue, error: clueError } = await supabase
      .from('clues')
      .select('entity_id')
      .eq('id', id)
      .single()

    if (clueError) throw clueError

    // Delete clue
    const { error: deleteError } = await supabase
      .from('clues')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Reorder remaining clues
    const { data: remainingClues, error: remainingError } = await supabase
      .from('clues')
      .select('id, order')
      .eq('entity_id', clue.entity_id)
      .order('order', { ascending: true })

    if (remainingError) throw remainingError

    // Update orders sequentially
    for (let i = 0; i < remainingClues.length; i++) {
      await supabase
        .from('clues')
        .update({ order: i + 1 })
        .eq('id', remainingClues[i].id)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting clue:', error)
    res.status(500).json({ error: 'Failed to delete clue' })
  }
})

/**
 * GET /admin/stats
 * Dashboard stats: published count per difficulty, total clues, avg clues per entity, unpublished count
 */
router.get('/stats', async (req, res) => {
  try {
    // Published count per difficulty
    const { data: publishedByDifficulty, error: publishedError } = await supabase
      .from('entities')
      .select('difficulty, is_published')
      .eq('is_published', true)

    if (publishedError) throw publishedError

    const publishedCount = {
      easy: 0,
      medium: 0,
      hard: 0,
      nightmare: 0
    }

    publishedByDifficulty?.forEach(entity => {
      publishedCount[entity.difficulty] = (publishedCount[entity.difficulty] || 0) + 1
    })

    // Total clues
    const { count: totalClues, error: cluesError } = await supabase
      .from('clues')
      .select('*', { count: 'exact', head: true })

    if (cluesError) throw cluesError

    // Total entities
    const { count: totalEntities, error: entitiesError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })

    if (entitiesError) throw entitiesError

    // Unpublished count
    const { count: unpublishedCount, error: unpublishedError } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', false)

    if (unpublishedError) throw unpublishedError

    // Avg clues per entity
    const avgCluesPerEntity = totalEntities > 0
      ? Math.round((totalClues / totalEntities) * 100) / 100
      : 0

    res.json({
      publishedCount,
      totalClues: totalClues || 0,
      totalEntities: totalEntities || 0,
      avgCluesPerEntity,
      unpublishedCount: unpublishedCount || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
