import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

router.get('/entities/:id/clues', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('clues')
      .select('*')
      .eq('entity_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    console.error('Error fetching clues:', error)
    res.status(500).json({ error: 'Failed to fetch clues' })
  }
})

router.post('/entities/:id/clues', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { text, citations, difficulty } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Clue text is required' })
    }

    const { data, error } = await supabase
      .from('clues')
      .insert({
        entity_id: id,
        text,
        citations: citations || null,
        difficulty: difficulty || null
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

router.put('/clues/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { text, citations, difficulty, order } = req.body

    const updateData: any = {}
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

router.delete('/clues/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { error: clueError } = await supabase
      .from('clues')
      .select('entity_id')
      .eq('id', id)
      .single()

    if (clueError) throw clueError

    const { error: deleteError } = await supabase
      .from('clues')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting clue:', error)
    res.status(500).json({ error: 'Failed to delete clue' })
  }
})

export default router
