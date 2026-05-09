import { Router } from 'express'
import { listDatasets } from '../db/entities.js'

/**
 * Public dataset metadata for the lobby. Returns only the fields the lobby
 * needs to render a picker / attribution; intentionally narrow so we don't
 * leak internals like is_official toggles to anonymous players.
 */
const router = Router()

router.get('/datasets', async (_req, res) => {
  try {
    const datasets = await listDatasets()
    const enabled = datasets
      .filter((d) => d.is_enabled)
      .map((d) => ({
        id: d.id,
        name: d.name,
        source: d.source,
        description: d.description,
        is_default: d.is_default
      }))

    res.json(enabled)
  } catch (error) {
    console.error('Error fetching public datasets:', error)
    res.status(500).json({ error: 'Failed to fetch datasets' })
  }
})

export default router
