import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Entity, Clue, Difficulty } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

type ClueForm = Omit<Partial<Clue>, 'id' | 'citations'> & {
  id: string | null
  text: string
  citations: string
  difficulty: Difficulty | null
  order: number
}

function AdminEntityEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()

  const [entity, setEntity] = useState<Partial<Entity> & { is_published: boolean }>({
    name: '',
    type: 'character',
    difficulty: 'medium',
    is_published: false,
  })
  const [clues, setClues] = useState<ClueForm[]>([])
  const [loading, setLoading] = useState(!isNew)
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

      setEntity(entityData)
      setClues(cluesData.sort((a, b) => a.order - b.order).map(c => ({
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

      let entityId = id

      if (isNew) {
        const response = await fetch(`${API_BASE_URL}/admin/entities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(entity),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create entity')
        }

        const newEntity = await response.json() as Entity
        entityId = newEntity.id
        navigate(`/admin/entities/${entityId}`, { replace: true })
      } else {
        const response = await fetch(`${API_BASE_URL}/admin/entities/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(entity),
        })

        if (!response.ok) {
          const error = await response.json()
          if (error.code === 'INSUFFICIENT_CLUES') {
            setPublishError('Entity must have at least 3 clues before publishing')
            setSaving(false)
            return
          }
          throw new Error(error.error || 'Failed to update entity')
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
              order: clue.order,
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
              order: clue.order,
            }),
          })
        }
      }

      navigate('/admin')
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
        order: clues.length + 1,
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

  const handleMoveClue = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === clues.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...clues]
    const temp = updated[index].order
    updated[index].order = updated[newIndex].order
    updated[newIndex].order = temp
    setClues(updated.sort((a, b) => a.order - b.order))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold">
                {isNew ? 'Create Entity' : 'Edit Entity'}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {publishError && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            {publishError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Entity Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={entity.name || ''}
                onChange={(e) => setEntity({ ...entity, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={entity.type || 'character'}
                  onChange={(e) => setEntity({ ...entity, type: e.target.value as 'character' | 'place' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="character">Character</option>
                  <option value="place">Place</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty *
                </label>
                <select
                  value={entity.difficulty || 'medium'}
                  onChange={(e) => setEntity({ ...entity, difficulty: e.target.value as Difficulty })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="nightmare">Nightmare</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={entity.is_published}
                  onChange={(e) => {
                    setEntity({ ...entity, is_published: e.target.checked })
                    setPublishError('')
                  }}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Published {clues.length < 3 && '(requires at least 3 clues)'}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Clues ({clues.length})</h2>
            <button
              onClick={handleAddClue}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Clue
            </button>
          </div>

          {clues.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No clues yet. Add at least 3 clues before publishing.
            </p>
          )}

          <div className="space-y-4">
            {clues.map((clue, index) => (
              <div key={clue.id || index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Clue {clue.order}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMoveClue(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveClue(index, 'down')}
                      disabled={index === clues.length - 1}
                      className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleDeleteClue(clue.id, index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clue Text *
                    </label>
                    <textarea
                      value={clue.text}
                      onChange={(e) => handleUpdateClue(index, 'text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Citations
                    </label>
                    <input
                      type="text"
                      value={clue.citations || ''}
                      onChange={(e) => handleUpdateClue(index, 'citations', e.target.value)}
                      placeholder="e.g., Exodus 2: 1; 3: 1 - 5, 21:1, 2."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !entity.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminEntityEditor
