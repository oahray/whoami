import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import LoadingState from './LoadingState'

function adminAppOrigin(): string {
  const configured = import.meta.env.VITE_ADMIN_URL?.replace(/\/$/, '')
  if (configured) return configured
  return 'http://localhost:5174'
}

/** Sends legacy `/admin/*` player-app URLs to the dedicated admin app. */
export default function AdminLegacyRedirect() {
  const location = useLocation()

  useEffect(() => {
    const suffix = location.pathname.replace(/^\/admin/, '') || '/'
    const target = `${adminAppOrigin()}${suffix}${location.search}${location.hash}`
    window.location.replace(target)
  }, [location.pathname, location.search, location.hash])

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center">
      <LoadingState label="Opening admin" layout="page" />
    </div>
  )
}
