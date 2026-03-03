import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

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

function AdminBulkImport() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleImport = async () => {
    try {
      setLoading(true)
      setError('')
      setResult(null)

      const parsed = JSON.parse(jsonInput)
      if (!Array.isArray(parsed)) {
        setError('JSON must be an array of entities')
        setLoading(false)
        return
      }

      const token = await getAccessToken()
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/admin/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ entities: parsed })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Import failed')
        setLoading(false)
        return
      }

      setResult(data)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Invalid JSON')
      setLoading(false)
    }
  }

  const handleClear = () => {
    setJsonInput('')
    setResult(null)
    setError('')
  }

  const exampleJson = `[
  {
    "name": "Moses",
    "type": "character",
    "difficulty": "medium",
    "is_published": true,
    "clues": [
      {
        "order": 1,
        "text": "Led the Israelites out of Egypt",
        "citations": "Exodus 1:1; 3:1-5",
        "difficulty": "medium"
      },
      {
        "order": 2,
        "text": "Received the Ten Commandments",
        "citations": "Exodus 20:1",
        "difficulty": "medium"
      }
    ]
  }
]`

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Import</h1>
            <p className="text-gray-600 mt-1">Import multiple entities and clues from JSON</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">JSON Format</h2>
          <div className="bg-gray-50 rounded p-4 mb-4">
            <pre className="text-xs overflow-x-auto">{exampleJson}</pre>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Each entity must have: <code className="bg-gray-100 px-1 rounded">name</code>, <code className="bg-gray-100 px-1 rounded">type</code>, <code className="bg-gray-100 px-1 rounded">difficulty</code></p>
            <p>• Each entity must have a <code className="bg-gray-100 px-1 rounded">clues</code> array with at least one clue</p>
            <p>• Each clue must have: <code className="bg-gray-100 px-1 rounded">order</code>, <code className="bg-gray-100 px-1 rounded">text</code></p>
            <p>• <code className="bg-gray-100 px-1 rounded">citations</code> and <code className="bg-gray-100 px-1 rounded">difficulty</code> are optional for clues</p>
            <p>• Entities are matched by name (case-sensitive). Existing entities will be updated.</p>
            <p>• All existing clues for an entity will be replaced with the new clues.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Paste JSON</h2>
            <button
              onClick={handleClear}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste your JSON array here..."
            className="w-full h-96 p-4 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={handleImport}
            disabled={loading || !jsonInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Importing...' : 'Import Entities'}
          </button>
          <button
            onClick={() => setJsonInput(exampleJson)}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
          >
            Load Example
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Import Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 rounded p-3">
                <div className="text-2xl font-bold text-blue-600">{result.summary.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="bg-green-50 rounded p-3">
                <div className="text-2xl font-bold text-green-600">{result.summary.created}</div>
                <div className="text-sm text-gray-600">Created</div>
              </div>
              <div className="bg-yellow-50 rounded p-3">
                <div className="text-2xl font-bold text-yellow-600">{result.summary.updated}</div>
                <div className="text-sm text-gray-600">Updated</div>
              </div>
              <div className="bg-red-50 rounded p-3">
                <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-red-800 mb-2">Errors:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {result.errors.map((err: string, index: number) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.summary.errors === 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800">
                ✓ Import completed successfully!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminBulkImport
