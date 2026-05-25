import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Dataset } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminDatasets() {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const { datasets, refresh, loading, error, setSelectedDatasetId } = useAdminDataset()

  const [actionError, setActionError] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState('')
  const [creating, setCreating] = useState(false)

  const patchDataset = async (id: string, patch: Partial<Dataset>) => {
    setActionError('')
    setPendingId(id)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/datasets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Failed to update dataset')
      }
      await refresh()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update dataset')
    } finally {
      setPendingId(null)
    }
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setActionError('')
    setCreating(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/datasets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          source: newSource.trim() || null
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || body.message || 'Failed to create dataset')
      }
      setNewName('')
      setNewSource('')
      setShowCreate(false)
      await refresh()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create dataset')
    } finally {
      setCreating(false)
    }
  }

  const handleManage = (dataset: Dataset) => {
    setSelectedDatasetId(dataset.id)
    navigate(`/admin/datasets/${dataset.id}`)
  }

  return (
    <AdminLayout breadcrumb="Overview / Datasets" title="Datasets">
      {(error || actionError) && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error || actionError}
        </div>
      )}

      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-slate-900 text-lg font-bold mb-0.5">Content datasets</h2>
            <p className="text-slate-500 text-sm">
              Each dataset is a self-contained set of entities and clues. At least one dataset must remain enabled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined">add</span>
            {showCreate ? 'Cancel' : 'New dataset'}
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-md border border-slate-200 shadow-sm p-4 mb-4 flex flex-col gap-3"
          >
            <label className="flex flex-col">
              <span className="text-slate-600 text-sm font-semibold mb-1.5">Name *</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Bible (NWT)"
                className="rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-primary focus:border-primary h-11 px-4"
                required
              />
            </label>
            <label className="flex flex-col">
              <span className="text-slate-600 text-sm font-semibold mb-1.5">Source / attribution</span>
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="Optional, e.g. NWT 2013 Revision"
                className="rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-primary focus:border-primary h-11 px-4"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false)
                  setNewName('')
                  setNewSource('')
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create dataset'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datasets.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No datasets yet. Run <code>npm run db:create-default-dataset</code> on the server to bootstrap one.
                    </td>
                  </tr>
                )}
                {datasets.map((dataset) => {
                  const isPending = pendingId === dataset.id
                  return (
                    <tr key={dataset.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-medium text-slate-900 whitespace-nowrap">
                        {dataset.name}
                        {dataset.is_official && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Official
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{dataset.source || '—'}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => patchDataset(dataset.id, { is_enabled: !dataset.is_enabled })}
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                            dataset.is_enabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={dataset.is_enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          <span className={`size-2 rounded-full ${dataset.is_enabled ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {dataset.is_enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="default-dataset"
                            checked={dataset.is_default}
                            disabled={isPending || !dataset.is_enabled}
                            onChange={() => patchDataset(dataset.id, { is_default: true })}
                            className="accent-primary"
                          />
                          <span className="text-slate-600 text-xs">{dataset.is_default ? 'Default' : 'Set default'}</span>
                        </label>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleManage(dataset)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm"
                        >
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-slate-500 text-sm">
            <span>{datasets.length} dataset{datasets.length === 1 ? '' : 's'}</span>
            {loading && <LoadingState label="Refreshing" layout="compact" />}
          </div>
        </div>
      </section>
    </AdminLayout>
  )
}

export default AdminDatasets
