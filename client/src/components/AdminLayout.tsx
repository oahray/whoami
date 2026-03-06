import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AdminLayoutProps {
  children: ReactNode
  /** Breadcrumb e.g. "Overview / Dashboard" */
  breadcrumb?: string
  /** Main title in content area (mobile may use in header) */
  title?: string
}

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
  { path: '/admin/entities', label: 'Entities', icon: 'database', exact: false },
  { path: '/admin/bulk-import', label: 'Bulk Import', icon: 'upload_file', exact: false },
]

const bottomNavItems = [
  { path: '/admin', label: 'Home', icon: 'home' },
  { path: '/admin/entities', label: 'Entities', icon: 'database' },
  { path: '/admin/bulk-import', label: 'Bulk Import', icon: 'upload_file' },
]

export function AdminLayout({ children, breadcrumb, title = 'Admin' }: AdminLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  const isNavActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return location.pathname === item.path
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  return (
    <div className="min-h-screen bg-slate-100 font-display text-slate-900 flex flex-col md:flex-row">
      {/* Desktop sidebar - fixed */}
      <aside className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:bottom-0 w-64 bg-white border-r border-slate-200 shrink-0 z-30">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">menu_book</span>
            <span className="font-bold text-lg tracking-tight text-slate-900">WhoAmI Admin</span>
          </div>
          {user?.email && (
            <p className="text-slate-500 text-sm mt-2 truncate" title={user.email}>{user.email}</p>
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
                  active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content - offset when sidebar is fixed */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 md:ml-64">
        {/* Top bar: breadcrumb (desktop) / email + sign out icon (mobile) */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="hidden md:block text-sm text-slate-500">{breadcrumb}</div>
            <div className="md:hidden flex items-center gap-2">
              <span className="material-symbols-outlined">menu_book</span>
              <span className="font-bold text-lg tracking-tight text-slate-900">WhoAmI Admin</span>
            </div>
            {user?.email && (
              <p className="md:hidden text-slate-600 text-sm truncate flex-1 min-w-0" title={user.email}>{user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex size-9 md:size-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>

        {/* Mobile bottom nav: Home, Entities, Bulk Import */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 safe-area-pb">
          {bottomNavItems.map((item) => {
            const active = item.path === '/admin'
              ? location.pathname === '/admin'
              : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 min-w-0 ${active ? 'text-primary' : 'text-slate-500'}`}
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
