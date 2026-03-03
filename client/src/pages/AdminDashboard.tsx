import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Entity, Stats, Difficulty } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function AdminDashboard() {
  const { user, signOut, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPublished, setFilterPublished] = useState<string>('all')

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

      const [entitiesData, statsData] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/entities`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          if (!res.ok) throw new Error('Request failed')
          return res.json() as Promise<Entity[]>
        }),
        fetch(`${API_BASE_URL}/admin/stats`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          if (!res.ok) throw new Error('Request failed')
          return res.json() as Promise<Stats>
        }),
      ])

      setEntities(entitiesData)
      setStats(statsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
      if (err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  const getTrafficLightColor = (count: number): string => {
    return count >= 10 ? 'bg-green-500' : 'bg-red-500'
  }

  const filteredEntities = entities.filter((entity) => {
    if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (filterType !== 'all' && entity.type !== filterType) {
      return false
    }
    if (filterDifficulty !== 'all' && entity.difficulty !== filterDifficulty) {
      return false
    }
    if (filterPublished === 'published' && !entity.is_published) {
      return false
    }
    if (filterPublished === 'unpublished' && entity.is_published) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {stats && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Entities</div>
                <div className="text-2xl font-bold">{stats.totalEntities}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Clues</div>
                <div className="text-2xl font-bold">{stats.totalClues}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Avg Clues/Entity</div>
                <div className="text-2xl font-bold">{stats.avgCluesPerEntity}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Unpublished</div>
                <div className="text-2xl font-bold">{stats.unpublishedCount}</div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Published by Difficulty</h3>
              <div className="grid grid-cols-4 gap-4">
                {(['easy', 'medium', 'hard', 'nightmare'] as Difficulty[]).map((difficulty) => {
                  const count = stats.publishedCount[difficulty] || 0
                  return (
                    <div key={difficulty} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(count)}`}></div>
                      <span className="text-sm capitalize">{difficulty}: {count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 bg-white rounded-lg shadow p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="character">Character</option>
                <option value="place">Place</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="nightmare">Nightmare</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Published</label>
              <select
                value={filterPublished}
                onChange={(e) => setFilterPublished(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Entities ({filteredEntities.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/admin/bulk-import')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Bulk Import
              </button>
              <button
                onClick={() => navigate('/admin/entities/new')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create New Entity
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clues
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntities.map((entity) => (
                  <tr key={entity.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entity.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {entity.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {entity.difficulty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entity.clueCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entity.is_published ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => navigate(`/admin/entities/${entity.id}`)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/admin/entities/${entity.id}/preview`)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
