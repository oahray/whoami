import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

interface BulkEntity {
  name: string
  type: 'character' | 'place'
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare'
  is_published?: boolean
  clues: Array<{
    order: number
    text: string
    citations?: string | null
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare' | null
  }>
}

router.post('/bulk-import', async (req: AuthRequest, res: Response) => {
  try {
    const { entities }: { entities: BulkEntity[] } = req.body

    if (!Array.isArray(entities)) {
      return res.status(400).json({ error: 'Entities must be an array' })
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[]
    }

    for (const entityData of entities) {
      try {
        if (!entityData.name || !entityData.type || !entityData.difficulty) {
          results.errors.push(`Entity missing required fields: ${entityData.name || 'unknown'}`)
          continue
        }

        if (!Array.isArray(entityData.clues) || entityData.clues.length === 0) {
          results.errors.push(`Entity "${entityData.name}" has no clues`)
          continue
        }

        const { data: existing } = await supabase
          .from('entities')
          .select('id, name, type, difficulty, is_published')
          .ilike('name', entityData.name)
          .maybeSingle()

        let entityId: string
        const entityPayload = {
          name: entityData.name,
          type: entityData.type,
          difficulty: entityData.difficulty,
          is_published: entityData.is_published || false
        }

        if (existing) {
          if (entityPayload.is_published && entityData.clues.length < 3) {
            results.errors.push(`Entity "${entityData.name}" cannot be published with less than 3 clues`)
            entityPayload.is_published = false
          }

          const { data, error } = await supabase
            .from('entities')
            .update(entityPayload)
            .eq('id', existing.id)
            .select()
            .single()

          if (error) throw error
          entityId = data.id
          results.updated++
        } else {
          if (entityPayload.is_published && entityData.clues.length < 3) {
            results.errors.push(`Entity "${entityData.name}" cannot be published with less than 3 clues`)
            entityPayload.is_published = false
          }

          const { data, error } = await supabase
            .from('entities')
            .insert(entityPayload)
            .select()
            .single()

          if (error) throw error
          entityId = data.id
          results.created++
        }

        const { data: existingClues, error: existingCluesError } = await supabase
          .from('clues')
          .select('id, text')
          .eq('entity_id', entityId)

        if (existingCluesError) throw existingCluesError

        const clueMap = new Map<string, string>()
        ;(existingClues || []).forEach(clue => {
          if (clue.text) {
            clueMap.set(clue.text, clue.id)
          }
        })

        for (const clueData of entityData.clues) {
          if (!clueData.text) {
            results.errors.push(`Entity "${entityData.name}" has clue with missing text at order ${clueData.order}`)
            continue
          }

          const cluePayload = {
            entity_id: entityId,
            order: clueData.order,
            text: clueData.text,
            citations: clueData.citations || null,
            difficulty: clueData.difficulty || null
          }

          const existingClueId = clueMap.get(clueData.text)

          if (existingClueId) {
            const { error: updateError } = await supabase
              .from('clues')
              .update(cluePayload)
              .eq('id', existingClueId)

            if (updateError) {
              results.errors.push(`Failed to update clue for "${entityData.name}" with text "${clueData.text}": ${updateError.message}`)
            }
          } else {
            const { error: insertError } = await supabase
              .from('clues')
              .insert(cluePayload)

            if (insertError) {
              results.errors.push(`Failed to create clue for "${entityData.name}" with text "${clueData.text}": ${insertError.message}`)
            }
          }
        }

        if (entityPayload.is_published && entityData.clues.length < 3) {
          const { error: unpublishError } = await supabase
            .from('entities')
            .update({ is_published: false })
            .eq('id', entityId)

          if (unpublishError) {
            results.errors.push(`Failed to unpublish "${entityData.name}": ${unpublishError.message}`)
          }
        }
      } catch (error: any) {
        results.errors.push(`Error processing "${entityData.name}": ${error.message}`)
      }
    }

    res.json({
      success: true,
      summary: {
        total: entities.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length
      },
      errors: results.errors
    })
  } catch (error: any) {
    console.error('Error in bulk import:', error)
    res.status(500).json({ error: 'Failed to process bulk import', message: error.message })
  }
})

export default router
