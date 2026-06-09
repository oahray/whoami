import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminDataset } from '../context/AdminDatasetContext'

const COLLAPSED_STORAGE_KEY = 'whoami_admin_dataset_bar_collapsed'

type AdminActiveDatasetBarProps = {
  /** When true, user is on the all-datasets management screen; hide this bar. */
  hidden?: boolean
}

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function AdminActiveDatasetBar({ hidden }: AdminActiveDatasetBarProps) {
  const {
    enabledDatasets,
    selectedDatasetId,
    selectedDataset,
    setSelectedDatasetId,
    loading,
    error,
  } = useAdminDataset()

  const [collapsed, setCollapsed] = useState(readCollapsedPreference)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  if (hidden) return null

  if (loading && !selectedDataset) {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-2 md:px-6">
        <p className="text-sm text-slate-500">Loading datasets…</p>
      </div>
    )
  }

  if (!selectedDataset) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 md:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-amber-900 font-medium">
          No active dataset. Enable or create a content pack to manage entities.
        </p>
        <Link
          to="/admin/datasets"
          className="text-sm font-semibold text-primary hover:text-primary/80 shrink-0"
        >
          Manage datasets →
        </Link>
      </div>
    )
  }

  const panelId = 'admin-active-dataset-panel'

  if (collapsed) {
    return (
      <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 md:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="material-symbols-outlined text-primary text-xl shrink-0"
            aria-hidden
          >
            collections_bookmark
          </span>
          <p className="min-w-0 flex-1 text-sm text-slate-600 truncate">
            <span className="font-semibold text-slate-500">Active:</span>{' '}
            <span className="font-bold text-slate-900">{selectedDataset.name}</span>
          </p>
          {enabledDatasets.length > 1 && (
            <select
              value={selectedDatasetId ?? ''}
              onChange={(e) => setSelectedDatasetId(e.target.value || null)}
              className="max-w-[9rem] sm:max-w-[11rem] shrink-0 bg-white border border-slate-200 rounded-md text-xs py-1.5 px-2 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20"
              aria-label="Switch active dataset"
            >
              {enabledDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/admin/datasets"
            className="hidden sm:inline-flex items-center text-xs font-semibold text-primary hover:text-primary/80 shrink-0"
          >
            All
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white/80 transition-colors"
            aria-expanded={false}
            aria-controls={panelId}
            title="Expand dataset details"
          >
            <span className="material-symbols-outlined text-xl">expand_more</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      id={panelId}
      className="border-b border-primary/20 bg-primary/5 px-4 py-3 md:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">
            collections_bookmark
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active dataset
            </p>
            <p className="text-lg font-bold text-slate-900 truncate">{selectedDataset.name}</p>
            {selectedDataset.source && (
              <p className="text-sm text-slate-600 truncate">{selectedDataset.source}</p>
            )}
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white/80 transition-colors sm:mt-0.5"
            aria-expanded={true}
            aria-controls={panelId}
            title="Collapse dataset banner"
          >
            <span className="material-symbols-outlined text-xl">expand_less</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 sm:pt-1">
          {enabledDatasets.length > 1 ? (
            <label className="flex flex-col gap-1 sm:min-w-[12rem]">
              <span className="text-xs font-semibold text-slate-500 sm:sr-only">Switch dataset</span>
              <select
                value={selectedDatasetId ?? ''}
                onChange={(e) => setSelectedDatasetId(e.target.value || null)}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm py-2.5 px-3 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20"
                aria-label="Switch active dataset"
              >
                {enabledDatasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <span className="size-2 rounded-full bg-green-500" aria-hidden />
              Only content pack
            </span>
          )}
          <Link
            to="/admin/datasets"
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            All datasets
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
