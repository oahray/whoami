import { useEffect, useState } from 'react'
import {
  fetchMaintenanceStatus,
  maintenancePollIntervalMs,
  MAINTENANCE_POLL_IDLE_MS,
  type MaintenanceStatus
} from '../lib/maintenance'

const IDLE_STATUS: MaintenanceStatus = {
  phase: 'none',
  endsAt: null,
  startsAt: null
}

type UseMaintenanceStatusOptions = {
  /** Re-check while this screen stays mounted. Interval follows the current phase. */
  poll?: boolean
}

export function useMaintenanceStatus(options: UseMaintenanceStatusOptions = {}) {
  const { poll = false } = options
  const [status, setStatus] = useState<MaintenanceStatus>(IDLE_STATUS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (delayMs: number) => {
      if (!poll || cancelled) return
      timer = setTimeout(() => {
        void load()
      }, delayMs)
    }

    const load = () =>
      fetchMaintenanceStatus()
        .then((next) => {
          if (cancelled) return
          setStatus(next)
          schedule(maintenancePollIntervalMs(next.phase))
        })
        .catch(() => {
          if (cancelled) return
          setStatus(IDLE_STATUS)
          schedule(MAINTENANCE_POLL_IDLE_MS)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [poll])

  return { status, loading }
}
