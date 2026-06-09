import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminBulkImport() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const { selectedDatasetId, selectedDataset } = useAdminDataset()
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

      if (!selectedDatasetId) {
        setError('No dataset selected. Open Datasets and pick one first.')
        setLoading(false)
        return
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/bulk-import?datasetId=${encodeURIComponent(selectedDatasetId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ entities: parsed, datasetId: selectedDatasetId })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Import failed')
        setLoading(false)
        return
      }

      setResult(data)
      setLoading(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
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
    "is_published": true,
    "aliases": [],
    "clues": [
      {
        "text": "Led the Israelites out of Egypt",
        "citations": "Exodus 1:1; 3:1-5",
        "difficulty": "medium"
      },
      {
        "text": "Received the Ten Commandments",
        "citations": "Exodus 20:1",
        "difficulty": "medium"
      }
    ]
  }
]`

  const breadcrumb = selectedDataset
    ? `Datasets / ${selectedDataset.name} / Bulk Import`
    : 'Overview / Bulk Import'

  return (
    <AdminLayout breadcrumb={breadcrumb} title="Bulk Import">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <button
            type="button"
            onClick={() => navigate('/entities')}
            className="text-primary flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-primary/10 font-medium"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="hidden sm:inline">Back to Entities</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pb-28 md:pb-8">
          {/* Format / instructions - responsive: full width on mobile, column on desktop */}
          <section className="order-2 lg:order-1">
            <h3 className="text-admin-fg text-lg font-bold mb-3">JSON Format</h3>
            <div className="bg-primary/5 rounded-lg p-4 md:p-5 border border-primary/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white">code</span>
                </div>
                <div className="min-w-0">
                  <p className="text-admin-fg font-bold text-sm">Format Rules</p>
                  <p className="text-admin-muted text-xs md:text-sm leading-relaxed mt-1">
                    JSON must be an array of entities. Each entity: name, type, clues array (text; optional citations, difficulty).
                    Re-importing the same data is safe: entities update only when fields differ; clues match by trimmed text and update when citations or difficulty change.
                  </p>
                </div>
              </div>
              <div className="bg-admin-muted-surface rounded-md p-3 font-mono text-[11px] md:text-xs text-primary/80 overflow-x-auto">
                <pre className="whitespace-pre-wrap break-all">{exampleJson}</pre>
              </div>
            </div>
          </section>

          {/* Paste area + actions */}
          <section className="order-1 lg:order-2 flex flex-col">
            <h3 className="text-admin-fg text-lg font-bold mb-3">Paste JSON Data</h3>
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setJsonInput(exampleJson)}
                className="text-admin-muted text-sm font-medium flex items-center gap-1.5 py-2 px-3 rounded-lg bg-admin-muted-surface hover:bg-admin-muted-surface transition-colors"
              >
                <span className="material-symbols-outlined text-lg">data_object</span>
                Load Example
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-admin-muted text-sm font-medium flex items-center gap-1 hover:text-red-500 py-2 px-3 rounded-lg hover:bg-red-50"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Clear
              </button>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[{"name": "...", "type": "character", "clues": [{"text": "..."}]}]'
              className="w-full min-h-[240px] md:min-h-[280px] lg:min-h-[320px] flex-1 bg-admin-muted-surface border border-admin-border rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary text-admin-fg placeholder-admin-muted resize-y"
            />

            {/* Desktop: primary action below textarea */}
            <div className="hidden md:block mt-4">
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || !jsonInput.trim()}
                className="w-full bg-primary text-white py-3 px-4 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <LoadingState label="Importing" layout="inline" className="text-white" />
                ) : (
                  <>
                    <span className="material-symbols-outlined">upload_file</span>
                    Import Entities
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-admin-panel rounded-lg shadow-sm border border-admin-border p-5 md:p-6">
            <h2 className="text-lg font-bold mb-4">Import Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-primary">{result.summary?.total ?? 0}</div>
                <div className="text-sm text-admin-muted">Entities in file</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-emerald-600">{result.summary?.created ?? 0}</div>
                <div className="text-sm text-admin-muted">Entities created</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-amber-600">{result.summary?.updated ?? 0}</div>
                <div className="text-sm text-admin-muted">Entities updated</div>
              </div>
              <div className="bg-admin-muted-surface rounded-lg p-3 border border-admin-border">
                <div className="text-xl md:text-2xl font-bold text-admin-fg">{result.summary?.entitiesUnchanged ?? 0}</div>
                <div className="text-sm text-admin-muted">Entities unchanged</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-teal-700">{result.summary?.cluesInserted ?? 0}</div>
                <div className="text-sm text-admin-muted">Clues added</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-indigo-700">{result.summary?.cluesUpdated ?? 0}</div>
                <div className="text-sm text-admin-muted">Clues updated</div>
              </div>
              <div className="bg-admin-muted-surface rounded-lg p-3 border border-admin-border">
                <div className="text-xl md:text-2xl font-bold text-admin-muted">{result.summary?.cluesUnchanged ?? 0}</div>
                <div className="text-sm text-admin-muted">Clues unchanged</div>
              </div>
              <div className="bg-rose-50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-rose-600">{result.summary?.errors ?? 0}</div>
                <div className="text-sm text-admin-muted">Errors</div>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-red-800 mb-2">Errors:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {result.errors.map((err: string, index: number) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.summary?.errors === 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                ✓ Import completed successfully!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: FAB for Import (above bottom nav) */}
      <div className="md:hidden fixed right-4 bottom-20 z-20">
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !jsonInput.trim()}
          className="flex items-center justify-center size-14 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95 transition-transform"
          title={loading ? 'Importing' : 'Import Entities'}
          aria-label={loading ? 'Importing' : 'Import Entities'}
          aria-busy={loading}
        >
          <span
            className={`material-symbols-outlined text-2xl ${loading ? 'animate-spin' : ''}`}
            aria-hidden
          >
            {loading ? 'progress_activity' : 'upload_file'}
          </span>
        </button>
      </div>
    </AdminLayout>
  )
}

export default AdminBulkImport
