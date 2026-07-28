import { useEffect, useState } from 'react'
import {
  formatMaintenanceCountdown,
  formatMaintenanceDateTime,
  getMaintenanceCountdownTarget,
  MAINTENANCE_COPY,
  type MaintenanceStatus
} from '../lib/maintenance'

interface MaintenanceBannerProps {
  status: MaintenanceStatus
}

export default function MaintenanceBanner({ status }: MaintenanceBannerProps) {
  const [now, setNow] = useState(() => Date.now())
  const target = getMaintenanceCountdownTarget(status)

  useEffect(() => {
    if (!target) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [target])

  if (status.phase === 'none') return null

  const message = MAINTENANCE_COPY[status.phase]
  const countdown = target ? formatMaintenanceCountdown(target, now) : null

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-950 dark:text-amber-100 text-sm"
    >
      <p className="font-medium">{message}</p>
      {countdown && status.phase === 'upcoming' && status.startsAt && (
        <p className="text-xs mt-1.5 text-amber-900/80 dark:text-amber-200/80">
          Starts in{' '}
          <span className="font-semibold tabular-nums text-amber-950 dark:text-amber-50">
            {countdown}
          </span>
          <span className="text-amber-900/60 dark:text-amber-200/60">
            {' '}
            · {formatMaintenanceDateTime(status.startsAt)}
          </span>
        </p>
      )}
      {countdown && status.phase !== 'upcoming' && status.endsAt && (
        <p className="text-xs mt-1.5 text-amber-900/80 dark:text-amber-200/80">
          Play resumes in{' '}
          <span className="font-semibold tabular-nums text-amber-950 dark:text-amber-50">
            {countdown}
          </span>
          <span className="text-amber-900/60 dark:text-amber-200/60">
            {' '}
            · by {formatMaintenanceDateTime(status.endsAt)}
          </span>
        </p>
      )}
    </div>
  )
}
