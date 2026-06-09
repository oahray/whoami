import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Entity, Clue } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const { selectedDataset } = useAdminDataset()

  const [entity, setEntity] = useState<Entity | null>(null)
  const [clues, setClues] = useState<Clue[]>([])
  const [revealedClues, setRevealedClues] = useState<Set<number>>(new Set())
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
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
      setClues(cluesData)
    } catch (err) {
      console.error('Error loading entity:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleClue = (clueIndex: number) => {
    const newRevealed = new Set(revealedClues)
    if (newRevealed.has(clueIndex)) {
      newRevealed.delete(clueIndex)
    } else {
      newRevealed.add(clueIndex)
    }
    setRevealedClues(newRevealed)
  }

  if (loading) {
    return (
      <AdminLayout title="Preview">
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading" layout="inline" />
        </div>
      </AdminLayout>
    )
  }

  if (!entity) {
    return (
      <AdminLayout title="Preview">
        <div className="flex items-center justify-center py-24"><div className="text-red-600">Entity not found</div></div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      breadcrumb={
        selectedDataset
          ? `Datasets / ${selectedDataset.name} / Entities / ${entity.name} / Preview`
          : `Overview / Entities / ${entity.name} / Preview`
      }
      title={`Preview: ${entity.name}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(`/entities/${id}`)}
            className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-admin-muted-surface text-admin-muted font-medium w-fit"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Edit
          </button>
          <span className="text-admin-muted text-sm">Entity Preview Mode</span>
        </div>

      <main className="flex-1 overflow-y-auto pb-28 md:pb-8">
        <div className="px-0 md:px-2">
          <div className="bg-admin-panel rounded-lg shadow-sm border border-admin-border overflow-hidden">
            <div className="p-5">
              <p className="text-primary text-sm font-semibold mb-1 uppercase tracking-wide">Category: {entity.type}</p>
              <h2 className="text-2xl font-bold mb-2">Who Am I?</h2>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-6">
          <h3 className="text-admin-muted text-xs font-bold uppercase tracking-widest mb-3 px-1">Clues (Admin Simulation)</h3>
          <div className="space-y-3">
            {clues.map((clue, clueIndex) => {
              const isRevealed = revealedClues.has(clueIndex)
              return (
                <div
                  key={clue.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border shadow-sm ${
                    isRevealed ? 'bg-admin-panel border-admin-border' : 'bg-admin-muted-surface border-dashed border-admin-border'
                  }`}
                >
                  <div className={`flex items-center justify-center rounded-lg shrink-0 size-12 ${isRevealed ? 'bg-primary/10 text-primary' : 'bg-admin-muted-surface text-admin-muted'}`}>
                    <span className="material-symbols-outlined">{isRevealed ? 'visibility' : 'visibility_off'}</span>
                  </div>
                  <div className="flex-1">
                    {isRevealed ? (
                      <p className="text-admin-fg text-base font-medium leading-snug">{clue.text}</p>
                    ) : (
                      <p className="text-admin-muted text-base italic font-medium">[Clue hidden from players]</p>
                    )}
                    <p className="text-admin-muted text-xs mt-1">Clue #{clueIndex + 1} • {isRevealed ? 'Revealed' : 'Hidden'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleClue(clueIndex)}
                    className={isRevealed ? 'bg-admin-muted-surface text-admin-fg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-admin-muted-surface' : 'bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90'}
                  >
                    {isRevealed ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-slate-900 rounded-lg p-6 text-center border border-slate-800">
            <h4 className="text-admin-muted text-xs font-bold uppercase tracking-widest mb-4">Solution</h4>
            {showAnswer ? (
              <div className="mb-6">
                <h2 className="text-white text-4xl font-black tracking-tight mb-2 uppercase">{entity.name}</h2>
                {clues.some(c => c.citations) && (
                  <ul className="list-disc list-inside space-y-1 text-admin-muted text-sm text-left max-w-sm mx-auto">
                    {clues.filter(c => c.citations).map((clue, i) => (
                      <li key={clue.id}>Clue {i + 1}: {clue.citations}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-admin-muted italic mb-4">[Answer hidden]</p>
            )}
            <button
              type="button"
              onClick={() => setShowAnswer(!showAnswer)}
              className="w-full bg-admin-panel text-admin-fg font-bold py-3 px-6 rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">check_circle</span>
              {showAnswer ? 'Hide Answer' : 'Show Answer'}
            </button>
          </div>
        </div>
      </main>
      </div>
    </AdminLayout>
  )
}

export default AdminPreview
