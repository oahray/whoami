import { useEffect, useState } from 'react'
import { fetchMaintenanceStatus, type MaintenanceStatus } from '../lib/maintenance'

export function useMaintenanceStatus() {
  const [status, setStatus] = useState<MaintenanceStatus>({
    phase: 'none',
    endsAt: null,
    startsAt: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void fetchMaintenanceStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        if (!cancelled) setStatus({ phase: 'none', endsAt: null, startsAt: null })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { status, loading }
}
