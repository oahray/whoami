import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import type { Dataset } from '../types'
import { useAuth } from './AuthContext'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'
const STORAGE_KEY = 'whoami_admin_dataset_id'

interface AdminDatasetContextValue {
  datasets: Dataset[]
  enabledDatasets: Dataset[]
  selectedDatasetId: string | null
  selectedDataset: Dataset | null
  setSelectedDatasetId: (id: string | null) => void
  refresh: () => Promise<void>
  loading: boolean
  error: string | null
}

const AdminDatasetContext = createContext<AdminDatasetContextValue | null>(null)

export function AdminDatasetProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      setError(null)
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${API_BASE_URL}/admin/datasets`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error || 'Failed to load datasets')
      }
      const data = (await res.json()) as Dataset[]
      setDatasets(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  useEffect(() => {
    if (user) {
      void refresh()
    } else {
      setDatasets([])
    }
  }, [user, refresh])

  const enabledDatasets = useMemo(() => datasets.filter((d) => d.is_enabled), [datasets])

  useEffect(() => {
    if (datasets.length === 0) return
    const stillExists = datasets.some((d) => d.id === selectedDatasetId)
    if (selectedDatasetId && stillExists) return

    const fallback =
      enabledDatasets.find((d) => d.is_default) ?? enabledDatasets[0] ?? null

    if (fallback) {
      setSelectedDatasetIdState(fallback.id)
      try {
        localStorage.setItem(STORAGE_KEY, fallback.id)
      } catch {
        // ignore storage failures (private mode etc.)
      }
    } else {
      setSelectedDatasetIdState(null)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }, [datasets, enabledDatasets, selectedDatasetId])

  const setSelectedDatasetId = useCallback((id: string | null) => {
    setSelectedDatasetIdState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  )

  const value: AdminDatasetContextValue = {
    datasets,
    enabledDatasets,
    selectedDatasetId,
    selectedDataset,
    setSelectedDatasetId,
    refresh,
    loading,
    error
  }

  return <AdminDatasetContext.Provider value={value}>{children}</AdminDatasetContext.Provider>
}

export function useAdminDataset() {
  const ctx = useContext(AdminDatasetContext)
  if (!ctx) {
    throw new Error('useAdminDataset must be used within AdminDatasetProvider')
  }
  return ctx
}
