import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Entity, Clue } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()

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
      setClues(cluesData.sort((a, b) => a.order - b.order))
    } catch (err) {
      console.error('Error loading entity:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleClue = (clueOrder: number) => {
    const newRevealed = new Set(revealedClues)
    if (newRevealed.has(clueOrder)) {
      newRevealed.delete(clueOrder)
    } else {
      newRevealed.add(clueOrder)
    }
    setRevealedClues(newRevealed)
  }

  if (loading) {
    return (
      <AdminLayout title="Preview">
        <div className="flex items-center justify-center py-24"><div className="text-slate-600">Loading...</div></div>
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
    <AdminLayout breadcrumb={`Overview / Entities / ${entity.name} / Preview`} title={`Preview: ${entity.name}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(`/admin/entities/${id}`)}
            className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-100 text-slate-600 font-medium w-fit"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Edit
          </button>
          <span className="text-slate-500 text-sm">Entity Preview Mode</span>
        </div>

      <main className="flex-1 overflow-y-auto pb-28 md:pb-8">
        <div className="px-0 md:px-2">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5">
              <p className="text-primary text-sm font-semibold mb-1 uppercase tracking-wide">Category: {entity.type}</p>
              <h2 className="text-2xl font-bold mb-2">Who Am I?</h2>
              <p className="text-slate-500 text-sm font-medium">Difficulty: {entity.difficulty}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-6">
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3 px-1">Clues (Admin Simulation)</h3>
          <div className="space-y-3">
            {clues.map((clue) => {
              const isRevealed = revealedClues.has(clue.order)
              return (
                <div
                  key={clue.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border shadow-sm ${
                    isRevealed ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300'
                  }`}
                >
                  <div className={`flex items-center justify-center rounded-lg shrink-0 size-12 ${isRevealed ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                    <span className="material-symbols-outlined">{isRevealed ? 'visibility' : 'visibility_off'}</span>
                  </div>
                  <div className="flex-1">
                    {isRevealed ? (
                      <p className="text-slate-900 text-base font-medium leading-snug">{clue.text}</p>
                    ) : (
                      <p className="text-slate-400 text-base italic font-medium">[Clue hidden from players]</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">Clue #{clue.order} • {isRevealed ? 'Revealed' : 'Hidden'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleClue(clue.order)}
                    className={isRevealed ? 'bg-slate-100 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-200' : 'bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90'}
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
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Solution</h4>
            {showAnswer ? (
              <div className="mb-6">
                <h2 className="text-white text-4xl font-black tracking-tight mb-2 uppercase">{entity.name}</h2>
                {clues.some(c => c.citations) && (
                  <ul className="list-disc list-inside space-y-1 text-slate-400 text-sm text-left max-w-sm mx-auto">
                    {clues.filter(c => c.citations).map((clue) => (
                      <li key={clue.id}>Clue {clue.order}: {clue.citations}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic mb-4">[Answer hidden]</p>
            )}
            <button
              type="button"
              onClick={() => setShowAnswer(!showAnswer)}
              className="w-full bg-white text-slate-900 font-bold py-3 px-6 rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
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
