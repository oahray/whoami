import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'
import { AdminLayout } from '../components/AdminLayout'
import {
  compareEntities,
  type EntitySortDir,
  type EntitySortKey
} from '../lib/entitySort'
import type { Entity } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'
const PAGE_SIZE = 50

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
  const [sortKey, setSortKey] = useState<EntitySortKey>('name')
  const [sortDir, setSortDir] = useState<EntitySortDir>('asc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadData()
  }, [selectedDatasetId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const token = await getAccessToken()
      if (!token) {
        navigate('/login')
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
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleSort = (key: EntitySortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  const filteredEntities = useMemo(() => {
    return entities
      .filter((entity) => {
        if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (filterType !== 'all' && entity.type !== filterType) return false
        if (filterPublished === 'published' && !entity.is_published) return false
        if (filterPublished === 'unpublished' && entity.is_published) return false
        return true
      })
      .sort((a, b) => compareEntities(a, b, sortKey, sortDir))
  }, [entities, searchQuery, filterType, filterPublished, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, filterType, filterPublished, sortKey, sortDir])

  const filteredCharacterCount = useMemo(
    () => filteredEntities.filter((entity) => entity.type === 'character').length,
    [filteredEntities]
  )
  const filteredPlaceCount = useMemo(
    () => filteredEntities.filter((entity) => entity.type === 'place').length,
    [filteredEntities]
  )

  const totalPages = Math.max(1, Math.ceil(filteredEntities.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedEntities = filteredEntities.slice(pageStart, pageStart + PAGE_SIZE)
  const rangeStart = filteredEntities.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filteredEntities.length)
  const typePillClass = (type: string) => {
    if (type === 'character') return 'bg-blue-100 text-blue-700'
    if (type === 'place') return 'bg-amber-100 text-amber-800'
    return 'bg-admin-muted-surface text-admin-fg'
  }

  const sortIcon = (key: EntitySortKey) => {
    if (sortKey !== key) return 'unfold_more'
    return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'
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
          <h2 className="text-admin-fg text-xl md:text-2xl font-bold">
            Entities Management
          </h2>
          <div className="hidden md:flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/bulk-import')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-admin-border bg-admin-panel text-admin-fg font-semibold hover:bg-admin-muted-surface transition-colors"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Bulk Import
            </button>
            <button
              type="button"
              onClick={() => navigate('/entities/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create New Entity
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted pointer-events-none">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities by name..."
              className="w-full bg-admin-panel border border-admin-border rounded-lg pl-10 pr-4 py-2.5 text-admin-fg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-admin-panel border border-admin-border rounded-lg text-sm py-2.5 px-4 text-admin-fg font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Types</option>
              <option value="character">Character</option>
              <option value="place">Place</option>
            </select>
            <select
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value)}
              className="bg-admin-panel border border-admin-border rounded-lg text-sm py-2.5 px-4 text-admin-fg font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>
        </div>

        <p className="mb-4 text-sm font-semibold text-admin-fg">
          {filterType !== 'place' && (
            <>
              {filteredCharacterCount} {filteredCharacterCount === 1 ? 'character' : 'characters'}
            </>
          )}
          {filterType === 'all' && ' · '}
          {filterType !== 'character' && (
            <>
              {filteredPlaceCount} {filteredPlaceCount === 1 ? 'place' : 'places'}
            </>
          )}
          {filteredEntities.length !== entities.length && (
            <span className="font-normal text-admin-muted"> (filtered)</span>
          )}
        </p>

        <div className="flex flex-col gap-3 mb-4 md:hidden">
          <button
            type="button"
            onClick={() => navigate('/entities/new')}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-lg"
          >
            <span className="material-symbols-outlined">add</span>
            Create New Entity
          </button>
          <button
            type="button"
            onClick={() => navigate('/bulk-import')}
            className="w-full flex items-center justify-center gap-2 bg-admin-muted-surface text-primary font-semibold py-3 px-4 rounded-lg border border-admin-border"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Bulk Import
          </button>
        </div>

        <div className="bg-admin-panel rounded-md border border-admin-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-admin-muted-surface text-admin-muted text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-admin-fg"
                      aria-label={`Sort by name ${sortKey === 'name' ? sortDir : 'asc'}`}
                    >
                      Name
                      <span className="material-symbols-outlined text-sm">{sortIcon('name')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('clues')}
                      className="inline-flex items-center gap-1 hover:text-admin-fg"
                      aria-label={`Sort by clues ${sortKey === 'clues' ? sortDir : 'desc'}`}
                    >
                      Clues
                      <span className="material-symbols-outlined text-sm">{sortIcon('clues')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {pagedEntities.map((entity) => (
                  <tr key={entity.id} className="hover:bg-admin-muted-surface/50">
                    <td className="px-4 py-4 font-medium text-admin-fg">{entity.name}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${typePillClass(entity.type)}`}>
                        {entity.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-admin-muted">{entity.clueCount ?? 0} Clues</td>
                    <td className="px-4 py-4">
                      {entity.is_published ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                          <span className="size-2 rounded-full bg-green-500" />
                          Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-admin-muted font-medium">
                          <span className="size-2 rounded-full bg-admin-muted" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/entities/${entity.id}`)}
                        className="inline-flex items-center justify-center size-9 rounded-lg text-admin-muted hover:bg-admin-muted-surface hover:text-primary transition-colors"
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
          <div className="px-4 py-3 border-t border-admin-border flex flex-wrap items-center justify-between gap-3 bg-admin-muted-surface/50">
            <span className="text-admin-muted text-sm">
              {filteredEntities.length === 0
                ? 'Showing 0'
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredEntities.length}`}
            </span>
            {filteredEntities.length > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-admin-border bg-admin-panel text-sm font-medium text-admin-fg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-admin-muted-surface"
                >
                  Previous
                </button>
                <span className="text-admin-muted text-sm tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-admin-border bg-admin-panel text-sm font-medium text-admin-fg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-admin-muted-surface"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="md:hidden fixed right-4 bottom-20 z-20">
        <button
          type="button"
          onClick={() => navigate('/entities/new')}
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
