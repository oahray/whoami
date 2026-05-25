import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Entity } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminEntities() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const { selectedDatasetId, selectedDataset } = useAdminDataset()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPublished, setFilterPublished] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [selectedDatasetId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const token = await getAccessToken()
      if (!token) {
        navigate('/admin/login')
        return
      }
      const url = new URL(`${API_BASE_URL}/admin/entities`)
      if (selectedDatasetId) url.searchParams.set('datasetId', selectedDatasetId)
      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        if (res.status === 400) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message || 'No dataset available')
        }
        throw new Error('Request failed')
      }
      const data = (await res.json()) as Entity[]
      setEntities(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load entities')
      if (err instanceof Error && (err.message.includes('Unauthorized') || err.message.includes('Forbidden'))) {
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredEntities = entities.filter((entity) => {
    if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterType !== 'all' && entity.type !== filterType) return false
    if (filterPublished === 'published' && !entity.is_published) return false
    if (filterPublished === 'unpublished' && entity.is_published) return false
    return true
  })

  const typePillClass = (type: string) => {
    if (type === 'character') return 'bg-blue-100 text-blue-700'
    if (type === 'place') return 'bg-amber-100 text-amber-800'
    return 'bg-slate-100 text-slate-700'
  }

  const breadcrumb = selectedDataset
    ? `Datasets / ${selectedDataset.name} / Entities`
    : 'Overview / Entities'

  if (loading) {
    return (
      <AdminLayout breadcrumb={breadcrumb} title="Entities">
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading" layout="inline" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout breadcrumb={breadcrumb} title="Entities">
      {error && (
        <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-slate-900 text-xl md:text-2xl font-bold">
            Entities Management
          </h2>
          <div className="hidden md:flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/admin/bulk-import')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Bulk Import
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/entities/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create New Entity
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities by name or clue..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-sm py-2.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Types</option>
              <option value="character">Character</option>
              <option value="place">Place</option>
            </select>
            <select
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-sm py-2.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
            <button type="button" className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="Filters">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4 md:hidden">
          <button
            type="button"
            onClick={() => navigate('/admin/entities/new')}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-lg"
          >
            <span className="material-symbols-outlined">add</span>
            Create New Entity
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/bulk-import')}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-primary font-semibold py-3 px-4 rounded-lg border border-slate-200"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Bulk Import
          </button>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Clues</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntities.map((entity) => (
                  <tr key={entity.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 font-medium text-slate-900">{entity.name}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${typePillClass(entity.type)}`}>
                        {entity.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{entity.clueCount ?? 0} Clues</td>
                    <td className="px-4 py-4">
                      {entity.is_published ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                          <span className="size-2 rounded-full bg-green-500" />
                          Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <span className="size-2 rounded-full bg-slate-400" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/entities/${entity.id}`)}
                        className="inline-flex items-center justify-center size-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-slate-500 text-sm">
              Showing {filteredEntities.length} of {entities.length}
            </span>
          </div>
        </div>
      </section>

      {/* Mobile: FAB for New entity (above bottom nav) */}
      <div className="md:hidden fixed right-4 bottom-20 z-20">
        <button
          type="button"
          onClick={() => navigate('/admin/entities/new')}
          className="flex items-center justify-center size-14 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-transform"
          title="New entity"
          aria-label="New entity"
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>
    </AdminLayout>
  )
}

export default AdminEntities
