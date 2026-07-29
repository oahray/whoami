import { FormEvent, useCallback, useEffect, useState } from 'react'
import LoadingState from './LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import type { Dataset, MaintenanceWindow } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:3001'

/** Matches server MAINTENANCE_FREEZE_LEAD_MS — new games blocked from this point. */
const FREEZE_LEAD_MS = 15 * 60 * 1000

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString()
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function windowAction(window: MaintenanceWindow, now = Date.now()): 'cancel' | 'end' {
  const freezeAt = new Date(window.starts_at).getTime() - FREEZE_LEAD_MS
  return now >= freezeAt ? 'end' : 'cancel'
}

export default function MaintenancePanel() {
  const { getAccessToken } = useAuth()
  const { datasets, selectedDatasetId } = useAdminDataset()
  const [windows, setWindows] = useState<MaintenanceWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [scope, setScope] = useState<'global' | 'dataset'>('global')
  const [datasetId, setDatasetId] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [creating, setCreating] = useState(false)

  const loadWindows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load maintenance windows')
      }
      setWindows(body as MaintenanceWindow[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance windows')
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    void loadWindows()
  }, [loadWindows])

  useEffect(() => {
    if (scope === 'dataset' && !datasetId && selectedDatasetId) {
      setDatasetId(selectedDatasetId)
    }
  }, [scope, datasetId, selectedDatasetId])

  const openForm = () => {
    const start = new Date(Date.now() + 20 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setStartsAt(toDatetimeLocalValue(start))
    setEndsAt(toDatetimeLocalValue(end))
    setScope(selectedDatasetId ? 'dataset' : 'global')
    setDatasetId(selectedDatasetId ?? '')
    setAdminNote('')
    setShowForm(true)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError('')
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          datasetId: scope === 'dataset' ? datasetId || null : null,
          adminNote: adminNote.trim() || null
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Failed to schedule maintenance')
      }
      setShowForm(false)
      await loadWindows()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule maintenance')
    } finally {
      setCreating(false)
    }
  }

  const handleRemove = async (maintenanceWindow: MaintenanceWindow) => {
    const action = windowAction(maintenanceWindow)
    if (
      action === 'end' &&
      !globalThis.confirm(
        'End this maintenance window now? New games will be allowed again immediately.'
      )
    ) {
      return
    }

    setPendingId(maintenanceWindow.id)
    setError('')
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/maintenance/${maintenanceWindow.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          body.message ||
            body.error ||
            (action === 'end' ? 'Failed to end maintenance' : 'Failed to cancel maintenance')
        )
      }
      await loadWindows()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : action === 'end'
            ? 'Failed to end maintenance'
            : 'Failed to cancel maintenance'
      )
    } finally {
      setPendingId(null)
    }
  }

  const upcoming = windows.filter((window) => new Date(window.ends_at).getTime() > Date.now())

  return (
    <section className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-admin-fg text-lg font-bold mb-0.5">Maintenance windows</h2>
          <p className="text-admin-muted text-sm">
            Schedule a global pause on new games. Optional dataset scope controls which dataset can be purged during the active phase.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : openForm())}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined">event</span>
          {showForm ? 'Cancel' : 'Schedule maintenance'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-admin-panel rounded-md border border-admin-border shadow-sm p-4 mb-4 flex flex-col gap-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className="text-admin-muted text-sm font-semibold mb-1.5">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg h-11 px-4"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-admin-muted text-sm font-semibold mb-1.5">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg h-11 px-4"
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-admin-muted text-sm font-semibold">Purge scope</legend>
            <label className="inline-flex items-center gap-2 text-sm text-admin-fg">
              <input
                type="radio"
                name="maintenance-scope"
                checked={scope === 'global'}
                onChange={() => setScope('global')}
              />
              All datasets (global window)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-admin-fg">
              <input
                type="radio"
                name="maintenance-scope"
                checked={scope === 'dataset'}
                onChange={() => setScope('dataset')}
              />
              One dataset only
            </label>
            {scope === 'dataset' && (
              <select
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                required
                className="rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg h-11 px-4 max-w-md"
              >
                <option value="" disabled>
                  Select dataset
                </option>
                {datasets.map((dataset: Dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <label className="flex flex-col">
            <span className="text-admin-muted text-sm font-semibold mb-1.5">Internal note</span>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Optional admin-only note"
              className="rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg h-11 px-4"
            />
          </label>

          <p className="text-admin-muted text-xs">
            New games are blocked from 15 minutes before start until the window ends. You can end an
            active window early from the list below.
          </p>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-admin-panel rounded-md border border-admin-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingState label="Loading maintenance windows" layout="compact" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="p-4 text-admin-muted text-sm">No upcoming maintenance windows.</p>
        ) : (
          <ul className="divide-y divide-admin-border">
            {upcoming.map((window) => {
              const action = windowAction(window)
              return (
                <li
                  key={window.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="text-admin-fg font-medium">
                      {formatLocal(window.starts_at)} → {formatLocal(window.ends_at)}
                    </p>
                    <p className="text-admin-muted text-sm mt-0.5">
                      Purge scope:{' '}
                      {window.dataset_id
                        ? datasets.find((d) => d.id === window.dataset_id)?.name ?? window.dataset_id
                        : 'All datasets'}
                      {action === 'end' && (
                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          {new Date(window.starts_at).getTime() <= Date.now() ? 'Active' : 'Freeze'}
                        </span>
                      )}
                    </p>
                    {window.admin_note && (
                      <p className="text-admin-muted text-xs mt-1">Note: {window.admin_note}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pendingId === window.id}
                    onClick={() => void handleRemove(window)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 ${
                      action === 'end'
                        ? 'border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
                        : 'border border-admin-border text-admin-fg hover:bg-admin-muted-surface'
                    }`}
                  >
                    {pendingId === window.id
                      ? action === 'end'
                        ? 'Ending…'
                        : 'Cancelling…'
                      : action === 'end'
                        ? 'End now'
                        : 'Cancel'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
