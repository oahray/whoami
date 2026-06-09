import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import type { MaintenanceStatus } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:3001'

interface DatasetDangerZoneProps {
  datasetId: string
}

export default function DatasetDangerZone({ datasetId }: DatasetDangerZoneProps) {
  const { getAccessToken } = useAuth()
  const { datasets, refresh, selectedDataset } = useAdminDataset()
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null)
  const [purgeAllowed, setPurgeAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [backupChecked, setBackupChecked] = useState(false)
  const [purging, setPurging] = useState(false)

  const enabledCount = datasets.filter((d) => d.is_enabled).length
  const isOnlyEnabled = enabledCount === 1 && selectedDataset?.is_enabled

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [statusRes, windowsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/maintenance/status`),
          (async () => {
            const token = await getAccessToken()
            return fetch(`${API_BASE_URL}/admin/maintenance`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          })()
        ])

        const status = (await statusRes.json()) as MaintenanceStatus
        const windows = windowsRes.ok ? await windowsRes.json() : []

        if (cancelled) return

        setMaintenance(status)

        const now = Date.now()
        const activeWindow = Array.isArray(windows)
          ? windows.find((window: { starts_at: string; ends_at: string; dataset_id: string | null }) => {
              const start = new Date(window.starts_at).getTime()
              const end = new Date(window.ends_at).getTime()
              const inActive = now >= start && now < end
              if (!inActive) return false
              return window.dataset_id == null || window.dataset_id === datasetId
            })
          : null

        setPurgeAllowed(Boolean(activeWindow))
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load maintenance status')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [datasetId, getAccessToken])

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      const token = await getAccessToken()
      const res = await fetch(`${API_BASE_URL}/admin/datasets/${datasetId}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Export failed')
      }

      const filename = `${(selectedDataset?.name ?? 'dataset').replace(/[^\w.-]+/g, '_')}-export.json`
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handlePurge = async () => {
    setPurging(true)
    setError('')
    try {
      const token = await getAccessToken()
      const url = new URL(`${API_BASE_URL}/admin/datasets/${datasetId}/content`)
      url.searchParams.set('selectedDatasetId', datasetId)
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Purge failed')
      }
      setShowPurgeModal(false)
      setConfirmText('')
      setBackupChecked(false)
      await refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Purge failed')
    } finally {
      setPurging(false)
    }
  }

  const purgeDisabledReason = loading
    ? 'Checking maintenance status…'
    : !purgeAllowed
      ? 'Purge is only available during an active maintenance window for this dataset.'
      : null

  const canSubmitPurge = confirmText === 'purge' && backupChecked && !purging

  return (
    <section className="mt-6">
      <div className="bg-admin-panel rounded-md border border-red-300 shadow-sm p-4">
        <h2 className="text-red-700 text-lg font-bold mb-0.5">Danger zone</h2>
        <p className="text-admin-muted text-sm mb-4">
          Export all entities and clues for backup, or purge all content in this dataset. The dataset row itself is kept.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {maintenance && maintenance.phase !== 'none' && (
          <p className="mb-4 text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm">
            Maintenance is currently {maintenance.phase}. New player games are paused app-wide.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-admin-border text-admin-fg font-semibold hover:bg-admin-muted-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined">download</span>
            {exporting ? 'Exporting…' : 'Export all data'}
          </button>
          <button
            type="button"
            onClick={() => setShowPurgeModal(true)}
            disabled={Boolean(purgeDisabledReason)}
            title={purgeDisabledReason ?? undefined}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">delete_forever</span>
            Purge all content…
          </button>
        </div>
        {purgeDisabledReason && (
          <p className="text-admin-muted text-xs mt-2">{purgeDisabledReason}</p>
        )}
      </div>

      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-dialog-title"
            className="w-full max-w-md rounded-lg bg-admin-panel border border-admin-border shadow-2xl p-5"
          >
            <h3 id="purge-dialog-title" className="text-admin-fg text-lg font-bold mb-2">
              Purge all content?
            </h3>
            <p className="text-admin-muted text-sm mb-3">
              This permanently deletes every entity and clue in{' '}
              <strong className="text-admin-fg">{selectedDataset?.name}</strong>. The empty dataset remains.
            </p>
            {isOnlyEnabled && (
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm mb-3">
                This is the only enabled dataset. New games will have no content until you import or enable another dataset.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm text-admin-fg mb-3">
              <input
                type="checkbox"
                checked={backupChecked}
                onChange={(e) => setBackupChecked(e.target.checked)}
                className="mt-1"
              />
              I have exported a backup of this dataset
            </label>
            <label className="flex flex-col gap-1.5 mb-4">
              <span className="text-admin-muted text-sm">Type <code>purge</code> to confirm</span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="rounded-lg border border-admin-border bg-admin-muted-surface text-admin-fg h-11 px-4"
                autoComplete="off"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false)
                  setConfirmText('')
                  setBackupChecked(false)
                }}
                className="px-4 py-2 rounded-lg border border-admin-border text-admin-fg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmitPurge}
                onClick={() => void handlePurge()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {purging ? 'Purging…' : 'Purge content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
