import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Stats } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminDashboard() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) {
        navigate('/admin/login')
        return
      }
      const res = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Request failed')
      const data = (await res.json()) as Stats
      setStats(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
      if (err instanceof Error && (err.message.includes('Unauthorized') || err.message.includes('Forbidden'))) {
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout breadcrumb="Overview / Dashboard" title="Admin Dashboard">
        <div className="flex items-center justify-center py-24">
          <div className="text-slate-600">Loading...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout breadcrumb="Overview / Dashboard" title="Admin Dashboard">
      {error && (
        <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-slate-900 text-lg font-bold mb-1">Statistics</h2>
        <p className="text-slate-500 text-sm mb-4">
          Overview of entities, clues, and content readiness. Game difficulty uses clue-level tags when the lobby mode is not “any”.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">track_changes</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Total entities</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.totalEntities ?? 0}</p>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">menu_book</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Total clues</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.totalClues ?? 0}</p>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">analytics</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Avg clues / entity</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.avgCluesPerEntity ?? 0}</p>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">draft</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Unpublished</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.unpublishedCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Published</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.publishedCount ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">category</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Entities by type</p>
              <p className="text-slate-900 text-lg font-bold mt-1">
                {stats?.entityCountByType.character ?? 0} {(stats?.entityCountByType.character ?? 0) === 1 ? 'character' : 'characters'}, {stats?.entityCountByType.place ?? 0} {(stats?.entityCountByType.place ?? 0) === 1 ? 'place' : 'places'}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">label_off</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Clues needing difficulty</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.cluesWithoutDifficulty ?? 0}</p>
          </div>
          <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 min-w-0 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">publish</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-sm font-medium leading-tight">Ready to publish</p>
              <p className="text-slate-500 text-xs mt-0.5">Drafts with 3+ clues</p>
            </div>
            <p className="text-slate-900 text-2xl font-bold shrink-0">{stats?.readyToPublishCount ?? 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Clues by difficulty</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-emerald-500 px-3 py-1.5">
              <span className="text-slate-700 font-medium text-sm">Easy</span>
              <span className="text-slate-900 font-bold">{stats?.difficultyCounts.easy ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-lime-500 px-3 py-1.5">
              <span className="text-slate-700 font-medium text-sm">Medium</span>
              <span className="text-slate-900 font-bold">{stats?.difficultyCounts.medium ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-amber-500 px-3 py-1.5">
              <span className="text-slate-700 font-medium text-sm">Hard</span>
              <span className="text-slate-900 font-bold">{stats?.difficultyCounts.hard ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-red-500 px-3 py-1.5">
              <span className="text-slate-700 font-medium text-sm">Nightmare</span>
              <span className="text-slate-900 font-bold">{stats?.difficultyCounts.nightmare ?? 0}</span>
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-slate-900 text-lg font-bold mb-0.5">Manage content</h2>
              <p className="text-slate-600 text-sm">Create, edit, publish, or import entities and clues.</p>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/admin/entities')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined">database</span>
                Entities
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/bulk-import')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border-2 border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined">upload_file</span>
                Bulk import
              </button>
            </div>
          </div>
        </div>
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
