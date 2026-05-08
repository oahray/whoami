import { Router, Response } from 'express'
import { supabase } from '../../db/supabase.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

interface BulkEntity {
  name: string
  type: 'character' | 'place'
  is_published?: boolean
  clues: Array<{
    text: string
    citations?: string | null
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare' | null
  }>
}

/** PostgreSQL ILIKE: escape % and _ so the pattern stays an exact match */
function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function normalizeClueText(text: string): string {
  return text.trim()
}

function normCitations(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null
  return String(value).trim()
}

type ExistingEntityRow = {
  id: string
  name: string
  type: string
  is_published: boolean
}

type ExistingClueRow = {
  id: string
  text: string
  citations: string | null
  difficulty: string | null
}

function cluePayloadMatchesRow(
  row: ExistingClueRow,
  payload: { citations?: string | null; difficulty?: BulkEntity['clues'][0]['difficulty'] }
): boolean {
  return (
    normCitations(row.citations) === normCitations(payload.citations) &&
    (row.difficulty ?? null) === (payload.difficulty ?? null)
  )
}

router.post('/bulk-import', async (req: AuthRequest, res: Response) => {
  try {
    const { entities }: { entities: BulkEntity[] } = req.body

    if (!Array.isArray(entities)) {
      return res.status(400).json({ error: 'Entities must be an array' })
    }

    const results = {
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesUnchanged: 0,
      cluesInserted: 0,
      cluesUpdated: 0,
      cluesUnchanged: 0,
      errors: [] as string[]
    }

    for (const entityData of entities) {
      try {
        const rawName = typeof entityData.name === 'string' ? entityData.name.trim() : ''
        if (!rawName || !entityData.type) {
          results.errors.push(`Entity missing required fields (name, type): ${entityData.name || 'unknown'}`)
          continue
        }

        if (!Array.isArray(entityData.clues) || entityData.clues.length === 0) {
          results.errors.push(`Entity "${rawName}" has no clues`)
          continue
        }

        const pattern = escapeIlikeExact(rawName)
        const { data: existing, error: findError } = await supabase
          .from('entities')
          .select('id, name, type, is_published')
          .ilike('name', pattern)
          .maybeSingle()

        if (findError) throw findError

        let entityPayload = {
          name: rawName,
          type: entityData.type,
          is_published: entityData.is_published || false
        }

        if (entityPayload.is_published && entityData.clues.length < 3) {
          results.errors.push(`Entity "${rawName}" cannot be published with less than 3 clues`)
          entityPayload = { ...entityPayload, is_published: false }
        }

        let entityId: string

        if (existing) {
          entityId = existing.id
          const existingRow = existing as ExistingEntityRow

          const patch: Partial<{ name: string; type: string; is_published: boolean }> = {}
          if (existingRow.name !== entityPayload.name) patch.name = entityPayload.name
          if (existingRow.type !== entityPayload.type) patch.type = entityPayload.type
          if (existingRow.is_published !== entityPayload.is_published) patch.is_published = entityPayload.is_published

          if (Object.keys(patch).length > 0) {
            const { error: updateErr } = await supabase.from('entities').update(patch).eq('id', entityId)

            if (updateErr) throw updateErr
            results.entitiesUpdated++
          } else {
            results.entitiesUnchanged++
          }
        } else {
          const { data, error } = await supabase.from('entities').insert(entityPayload).select().single()

          if (error) throw error
          entityId = data.id
          results.entitiesCreated++
        }

        const { data: existingClues, error: existingCluesError } = await supabase
          .from('clues')
          .select('id, text, citations, difficulty')
          .eq('entity_id', entityId)

        if (existingCluesError) throw existingCluesError

        const clueByNormalizedText = new Map<string, ExistingClueRow>()
        for (const clue of existingClues || []) {
          const key = normalizeClueText(clue.text || '')
          if (!key) continue
          if (!clueByNormalizedText.has(key)) {
            clueByNormalizedText.set(key, clue as ExistingClueRow)
          }
        }

        for (let index = 0; index < entityData.clues.length; index++) {
          const clueData = entityData.clues[index]
          const textNorm = normalizeClueText(clueData.text || '')
          if (!textNorm) {
            results.errors.push(`Entity "${rawName}" has clue with missing text at position ${index + 1}`)
            continue
          }

          const cluePayload = {
            entity_id: entityId,
            text: textNorm,
            citations: clueData.citations ?? null,
            difficulty: clueData.difficulty ?? null
          }

          const existingClue = clueByNormalizedText.get(textNorm)

          if (existingClue) {
            if (cluePayloadMatchesRow(existingClue, clueData)) {
              results.cluesUnchanged++
            } else {
              const { error: updateError } = await supabase
                .from('clues')
                .update({
                  entity_id: entityId,
                  text: textNorm,
                  citations: cluePayload.citations ?? null,
                  difficulty: cluePayload.difficulty ?? null
                })
                .eq('id', existingClue.id)

              if (updateError) {
                results.errors.push(`Failed to update clue for "${rawName}" with text "${textNorm}": ${updateError.message}`)
              } else {
                results.cluesUpdated++
              }
            }
          } else {
            const { data: inserted, error: insertError } = await supabase
              .from('clues')
              .insert(cluePayload)
              .select('id')
              .single()

            if (insertError) {
              results.errors.push(`Failed to create clue for "${rawName}" with text "${textNorm}": ${insertError.message}`)
            } else if (inserted?.id) {
              results.cluesInserted++
              clueByNormalizedText.set(textNorm, {
                id: inserted.id,
                text: textNorm,
                citations: normCitations(cluePayload.citations),
                difficulty: cluePayload.difficulty ?? null
              })
            }
          }
        }

        const { count: clueCount, error: countErr } = await supabase
          .from('clues')
          .select('*', { count: 'exact', head: true })
          .eq('entity_id', entityId)

        if (countErr) throw countErr

        if ((clueCount ?? 0) < 3) {
          const { data: entRow, error: entErr } = await supabase
            .from('entities')
            .select('is_published')
            .eq('id', entityId)
            .single()

          if (entErr) throw entErr
          if (entRow?.is_published) {
            const { error: unpublishError } = await supabase
              .from('entities')
              .update({ is_published: false })
              .eq('id', entityId)

            if (unpublishError) {
              results.errors.push(`Failed to unpublish "${rawName}": ${unpublishError.message}`)
            }
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
        created: results.entitiesCreated,
        updated: results.entitiesUpdated,
        entitiesUnchanged: results.entitiesUnchanged,
        cluesInserted: results.cluesInserted,
        cluesUpdated: results.cluesUpdated,
        cluesUnchanged: results.cluesUnchanged,
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
