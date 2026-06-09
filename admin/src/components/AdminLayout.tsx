import { ReactNode, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AdminActiveDatasetBar from './AdminActiveDatasetBar'
import ThemeMenu from './ThemeMenu'
import { useAuth } from '../context/AuthContext'
import { useAdminDataset } from '../context/AdminDatasetContext'

interface AdminLayoutProps {
  children: ReactNode
  breadcrumb?: string
  title?: string
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { path: '/datasets', label: 'Datasets', icon: 'collections_bookmark', exact: false },
  { path: '/entities', label: 'Entities', icon: 'database', exact: false },
  { path: '/bulk-import', label: 'Bulk Import', icon: 'upload_file', exact: false },
]

const bottomNavItems = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/datasets', label: 'Sets', icon: 'collections_bookmark' },
  { path: '/entities', label: 'Entities', icon: 'database' },
  { path: '/bulk-import', label: 'Import', icon: 'upload_file' },
]

export function AdminLayout({ children, breadcrumb, title = 'Admin' }: AdminLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { setSelectedDatasetId } = useAdminDataset()

  const isDatasetListPage = location.pathname === '/datasets'

  useEffect(() => {
    const match = location.pathname.match(/^\/datasets\/([^/]+)/)
    if (match?.[1]) {
      setSelectedDatasetId(match[1])
    }
  }, [location.pathname, setSelectedDatasetId])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isNavActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return location.pathname === item.path
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  void title

  return (
    <div className="min-h-screen bg-admin-canvas font-display text-admin-fg flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:bottom-0 w-64 bg-admin-sidebar border-r border-admin-border shrink-0 z-30 text-admin-sidebar-fg">
        <div className="p-5 border-b border-admin-border">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-accent">menu_book</span>
            <span className="font-bold text-lg tracking-tight">WhoAmI Admin</span>
          </div>
          {user?.email && (
            <p className="text-admin-sidebar-muted text-sm mt-2 truncate" title={user.email}>
              {user.email}
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isNavActive(item)
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  active
                    ? 'bg-accent/20 text-accent'
                    : 'text-admin-sidebar-muted hover:bg-admin-sidebar-hover hover:text-admin-sidebar-fg'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-admin-border flex items-center gap-2">
          <ThemeMenu variant="sidebar" className="shrink-0" />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-left text-admin-sidebar-muted hover:bg-admin-sidebar-hover hover:text-admin-sidebar-fg font-medium transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 md:ml-64">
        <header className="sticky top-0 z-40 bg-admin-panel border-b border-admin-border px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="hidden md:flex text-sm text-admin-muted min-w-0">
              <span className="truncate">{breadcrumb}</span>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <span className="material-symbols-outlined text-accent">menu_book</span>
              <span className="font-bold text-lg tracking-tight">WhoAmI Admin</span>
            </div>
            {user?.email && (
              <p className="md:hidden text-admin-muted text-sm truncate flex-1 min-w-0" title={user.email}>
                {user.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 md:hidden">
            <ThemeMenu />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex size-9 items-center justify-center rounded-full text-admin-muted hover:bg-admin-muted-surface transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>

        <AdminActiveDatasetBar hidden={isDatasetListPage} />

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-admin-panel border-t border-admin-border flex items-center justify-around py-2 safe-area-pb">
          {bottomNavItems.map((item) => {
            const active =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 min-w-0 ${
                  active ? 'text-accent' : 'text-admin-muted'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
