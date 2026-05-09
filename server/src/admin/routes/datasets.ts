import { Router, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  createDataset,
  DatasetUpdateError,
  getDataset,
  listDatasets,
  updateDatasetFlags,
  type DatasetCreateInput,
  type DatasetUpdateInput
} from '../../db/entities.js'

const router = Router()

router.get('/datasets', async (_req: AuthRequest, res: Response) => {
  try {
    const datasets = await listDatasets()
    res.json(datasets)
  } catch (error) {
    console.error('Error fetching datasets:', error)
    res.status(500).json({ error: 'Failed to fetch datasets' })
  }
})

router.get('/datasets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const dataset = await getDataset(req.params.id)
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' })
    }
    res.json(dataset)
  } catch (error) {
    console.error('Error fetching dataset:', error)
    res.status(500).json({ error: 'Failed to fetch dataset' })
  }
})

router.post('/datasets', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as Partial<DatasetCreateInput>
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!name) {
      return res.status(400).json({ error: 'Dataset name is required' })
    }

    const dataset = await createDataset({
      name,
      source: body.source ?? null,
      description: body.description ?? null,
      is_official: body.is_official ?? false,
      is_enabled: body.is_enabled ?? true,
      is_default: body.is_default ?? false
    })

    res.status(201).json(dataset)
  } catch (error: any) {
    console.error('Error creating dataset:', error)
    if (error?.message?.includes('duplicate key')) {
      return res.status(409).json({ error: 'A dataset with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create dataset' })
  }
})

router.patch('/datasets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as Partial<DatasetUpdateInput>
    const patch: DatasetUpdateInput = {}

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (!trimmed) {
        return res.status(400).json({ error: 'Dataset name cannot be empty' })
      }
      patch.name = trimmed
    }

    if (body.source !== undefined) patch.source = body.source
    if (body.description !== undefined) patch.description = body.description
    if (typeof body.is_official === 'boolean') patch.is_official = body.is_official
    if (typeof body.is_enabled === 'boolean') patch.is_enabled = body.is_enabled
    if (typeof body.is_default === 'boolean') patch.is_default = body.is_default

    const dataset = await updateDatasetFlags(req.params.id, patch)
    res.json(dataset)
  } catch (error: any) {
    if (error instanceof DatasetUpdateError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400
      return res.status(status).json({ error: error.code, message: error.message })
    }
    console.error('Error updating dataset:', error)
    res.status(500).json({ error: 'Failed to update dataset' })
  }
})

export default router
