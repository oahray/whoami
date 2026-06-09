import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Entity, Clue, Difficulty } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

type ClueForm = Omit<Partial<Clue>, 'id' | 'citations'> & {
  id: string | null
  text: string
  citations: string
  difficulty: Difficulty | null
}

function AdminEntityEditor() {
  const { id } = useParams<{ id: string }>()
  // When creating a new entity we use the `/admin/entities/new` route, which has no `id` param.
  // Treat the absence of an `id` param as "new", and any defined `id` as "edit".
  const isNew = !id
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const { selectedDatasetId, selectedDataset } = useAdminDataset()

  const [entity, setEntity] = useState<Partial<Entity> & { is_published: boolean; aliases: string[] }>({
    name: '',
    type: 'character',
    is_published: false,
    aliases: []
  })
  const [aliasesText, setAliasesText] = useState('')
  const [clues, setClues] = useState<ClueForm[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [publishError, setPublishError] = useState('')

  useEffect(() => {
    if (!isNew && id) {
      loadEntity()
    }
  }, [id])

  const loadEntity = async () => {
    if (!id) return
    try {
      setLoading(true)
      const token = await getAccessToken()

      const [entityData, cluesData] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/entities/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          if (!res.ok) throw new Error('Failed to load entity')
          return res.json() as Promise<Entity>
        }),
        fetch(`${API_BASE_URL}/admin/entities/${id}/clues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          if (!res.ok) throw new Error('Failed to load clues')
          return res.json() as Promise<Clue[]>
        }),
      ])

      setEntity({
        ...entityData,
        is_published: entityData.is_published ?? false,
        aliases: Array.isArray(entityData.aliases) ? entityData.aliases : []
      })
      setAliasesText(Array.isArray(entityData.aliases) ? entityData.aliases.join(', ') : '')
      setClues(cluesData.map(c => ({
        ...c,
        id: c.id,
        citations: c.citations || '',
      })))
    } catch (err: any) {
      setError(err.message || 'Failed to load entity')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      const token = await getAccessToken()

      let entityId: string | undefined = id

      const aliases = aliasesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      if (isNew) {
        if (!selectedDatasetId) {
          setError('No dataset selected. Open Datasets and pick one first.')
          setSaving(false)
          return
        }
        const createPayload = {
          name: entity.name ?? '',
          type: entity.type ?? 'character',
          is_published: entity.is_published ?? false,
          aliases,
          datasetId: selectedDatasetId,
        }
        const response = await fetch(`${API_BASE_URL}/admin/entities?datasetId=${encodeURIComponent(selectedDatasetId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(createPayload),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to create entity')
        }

        const newEntity = data as Entity
        if (!newEntity?.id) {
          throw new Error('Server did not return the created entity; please try again.')
        }
        entityId = newEntity.id
        navigate(`/entities/${entityId}`, { replace: true })
      } else {
        if (!id || id === 'undefined') {
          setError('Invalid entity id; please go back to entities and try again.')
          return
        }
        const updatePayload = {
          name: entity.name,
          type: entity.type,
          is_published: entity.is_published,
          aliases,
        }
        const response = await fetch(`${API_BASE_URL}/admin/entities/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatePayload),
        })

        const data = await response.json()
        if (!response.ok) {
          if ((data as { code?: string }).code === 'INSUFFICIENT_CLUES') {
            setPublishError('Entity must have at least 3 clues before publishing')
            setSaving(false)
            return
          }
          throw new Error((data as { error?: string }).error || 'Failed to update entity')
        }
      }

      for (const clue of clues) {
        if (clue.id) {
          await fetch(`${API_BASE_URL}/admin/clues/${clue.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: clue.text,
              citations: clue.citations || null,
              difficulty: clue.difficulty || null,
            }),
          })
        } else {
          await fetch(`${API_BASE_URL}/admin/entities/${entityId}/clues`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: clue.text,
              citations: clue.citations || null,
              difficulty: clue.difficulty || null,
            }),
          })
        }
      }

      navigate('/entities')
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleAddClue = () => {
    setClues([
      ...clues,
      {
        id: null,
        text: '',
        citations: '',
        difficulty: null,
      },
    ])
  }

  const handleUpdateClue = (index: number, field: keyof ClueForm, value: any) => {
    const updated = [...clues]
    updated[index] = { ...updated[index], [field]: value }
    setClues(updated)
  }

  const handleDeleteClue = async (clueId: string | null, index: number) => {
    if (!clueId) {
      setClues(clues.filter((_, i) => i !== index))
      return
    }

    try {
      const token = await getAccessToken()
      await fetch(`${API_BASE_URL}/admin/clues/${clueId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      await loadEntity()
    } catch (err: any) {
      setError(err.message || 'Failed to delete clue')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-admin-canvas font-display flex items-center justify-center">
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading" layout="inline" />
        </div>
      </div>
    )
  }

  const datasetCrumb = selectedDataset ? `Datasets / ${selectedDataset.name} / Entities` : 'Overview / Entities'
  const breadcrumb = isNew
    ? `${datasetCrumb} / New`
    : `${datasetCrumb} / ${entity.name || 'Edit'}`

  return (
    <AdminLayout
      breadcrumb={breadcrumb}
      title={isNew ? 'Create Entity' : 'Edit Entity'}
    >
      <div className="max-w-3xl mx-auto pb-36 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate('/entities')}
            className="text-primary flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-primary/10 font-medium w-fit"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Entities
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !entity.name}
            className="hidden md:flex items-center gap-2 bg-primary text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-primary/90 disabled:opacity-50 shadow-sm"
          >
            <span className="material-symbols-outlined">check</span>
            Save
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {publishError && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg text-sm">
            {publishError}
          </div>
        )}

        <section className="flex flex-col gap-4 mb-6">
          <h2 className="text-admin-fg text-xl font-bold tracking-tight px-1">Entity Details</h2>
          <div className="bg-admin-panel rounded-lg p-4 shadow-sm border border-admin-border flex flex-col gap-4">
            <label className="flex flex-col w-full">
              <p className="text-admin-muted text-sm font-semibold mb-1.5 ml-1">Name *</p>
              <input
                type="text"
                value={entity.name || ''}
                onChange={(e) => setEntity({ ...entity, name: e.target.value })}
                className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary h-12 px-4 font-medium"
                required
              />
            </label>
            <label className="flex flex-col">
              <p className="text-admin-muted text-sm font-semibold mb-1.5 ml-1">Type *</p>
              <select
                value={entity.type || 'character'}
                onChange={(e) => setEntity({ ...entity, type: e.target.value as 'character' | 'place' })}
                className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary h-12 px-4 font-medium"
              >
                <option value="character">Character</option>
                <option value="place">Place</option>
              </select>
            </label>
            <label className="flex flex-col">
              <p className="text-admin-muted text-sm font-semibold mb-1.5 ml-1">
                Aliases <span className="text-admin-muted font-normal">(comma-separated)</span>
              </p>
              <input
                type="text"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="e.g. King David, Abram"
                className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary h-12 px-4 font-medium"
              />
              <span className="text-admin-muted text-xs mt-1 ml-1">
                Alternate names accepted as correct guesses.
              </span>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-admin-muted-surface border border-admin-border mt-2">
              <div className="flex flex-col">
                <span className="text-admin-fg font-semibold">Published</span>
                <span className="text-admin-muted text-xs">{clues.length < 3 ? 'Requires at least 3 clues' : 'Visible to players'}</span>
              </div>
              <input
                type="checkbox"
                checked={entity.is_published}
                onChange={(e) => {
                  setEntity({ ...entity, is_published: e.target.checked })
                  setPublishError('')
                }}
                className="rounded accent-primary h-5 w-5"
              />
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-admin-fg text-xl font-bold tracking-tight">Clues</h2>
            <span className="text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">{clues.length} Total</span>
          </div>

          {clues.length === 0 && (
            <p className="text-admin-muted text-center py-8 bg-admin-panel rounded-lg border border-admin-border">
              No clues yet. Add at least 3 clues before publishing.
            </p>
          )}

          <div className="space-y-4">
            {clues.map((clue, index) => (
              <div key={clue.id || index} className="bg-admin-panel rounded-lg p-4 shadow-sm border border-admin-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted text-xs font-bold uppercase tracking-wider">Clue #{index + 1}</span>
                  <button type="button" onClick={() => handleDeleteClue(clue.id, index)} className="p-1.5 text-admin-muted hover:text-red-500">
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
                <textarea
                  value={clue.text}
                  onChange={(e) => handleUpdateClue(index, 'text', e.target.value)}
                  placeholder="Enter clue text..."
                  rows={2}
                  required
                  className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary p-3 min-h-[80px] text-sm leading-relaxed"
                />
                <label className="flex flex-col">
                  <p className="text-admin-muted text-sm font-semibold mb-1.5 ml-1">Difficulty</p>
                  <select
                    value={clue.difficulty ?? ''}
                    onChange={(e) => handleUpdateClue(index, 'difficulty', (e.target.value || null) as Difficulty | null)}
                    className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary h-11 px-3 font-medium text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="nightmare">Nightmare</option>
                  </select>
                </label>
                <input
                  type="text"
                  value={clue.citations || ''}
                  onChange={(e) => handleUpdateClue(index, 'citations', e.target.value)}
                  placeholder="e.g., Exodus 2:1; 3:1-5"
                  className="w-full rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg focus:ring-primary focus:border-primary p-3 text-sm"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddClue}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-lg border-2 border-dashed border-primary/30 text-primary font-bold hover:bg-primary/5 transition-all mt-2"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add New Clue
          </button>
        </section>

        <div className="hidden md:flex items-center justify-end gap-3 mt-8 pt-6 border-t border-admin-border">
          <button
            type="button"
            onClick={() => navigate('/entities')}
            className="py-3 px-5 rounded-lg bg-admin-muted-surface text-admin-fg font-semibold hover:bg-admin-muted-surface"
          >
            Back to Entities
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !entity.name}
            className="py-3 px-6 rounded-lg bg-primary text-white font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Mobile fixed bar above bottom nav */}
      <div className="fixed left-0 right-0 bottom-20 md:hidden max-w-3xl mx-auto bg-admin-panel/95 backdrop-blur-lg border-t border-admin-border p-4 flex gap-3 z-10">
        <button type="button" onClick={() => navigate('/entities')} className="flex-1 py-4 px-6 rounded-lg bg-admin-muted-surface text-admin-muted font-bold hover:bg-admin-muted-surface">
          Back to Entities
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !entity.name}
          className="flex-[2] py-4 px-6 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AdminLayout>
  )
}

export default AdminEntityEditor
