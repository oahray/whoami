import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()

  const [entity, setEntity] = useState(null)
  const [clues, setClues] = useState([])
  const [revealedClues, setRevealedClues] = useState(new Set())
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntity()
  }, [id])

  const loadEntity = async () => {
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
          return res.json()
        }),
        fetch(`${API_BASE_URL}/admin/entities/${id}/clues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          if (!res.ok) throw new Error('Failed to load clues')
          return res.json()
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

  const toggleClue = (clueOrder) => {
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-600">Entity not found</div>
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
                onClick={() => navigate(`/admin/entities/${id}`)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Editor
              </button>
              <h1 className="text-xl font-bold">Preview: {entity.name}</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Who Am I?</h2>
            <p className="text-gray-600">Difficulty: {entity.difficulty}</p>
          </div>

          {/* Clues */}
          <div className="space-y-4 mb-8">
            {clues.map((clue, index) => {
              const isRevealed = revealedClues.has(clue.order)
              return (
                <div
                  key={clue.id}
                  className="border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-500">
                      Clue {clue.order}
                    </span>
                    <button
                      onClick={() => toggleClue(clue.order)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {isRevealed ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  {isRevealed ? (
                    <p className="text-lg">{clue.text}</p>
                  ) : (
                    <p className="text-lg text-gray-400 italic">
                      [Clue hidden - click Reveal]
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Answer Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Answer</h3>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAnswer ? 'Hide Answer' : 'Show Answer'}
              </button>
            </div>
            {showAnswer ? (
              <div>
                <p className="text-2xl font-bold mb-2">{entity.name}</p>
                {clues.some(c => c.citations) && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Citations:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {clues
                        .filter(c => c.citations)
                        .map((clue, index) => (
                          <li key={clue.id} className="text-sm text-gray-700">
                            Clue {clue.order}: {clue.citations}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic">[Answer hidden - click Show Answer]</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPreview
