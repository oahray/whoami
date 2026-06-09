import {
  formatMaintenanceDateTime,
  MAINTENANCE_COPY,
  type MaintenanceStatus
} from '../lib/maintenance'

interface MaintenanceBannerProps {
  status: MaintenanceStatus
}

export default function MaintenanceBanner({ status }: MaintenanceBannerProps) {
  if (status.phase === 'none') return null

  const message = MAINTENANCE_COPY[status.phase]

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 text-sm"
    >
      <p className="font-medium">{message}</p>
      {status.phase === 'upcoming' && status.startsAt && (
        <p className="text-xs mt-1 text-amber-900/80">
          Scheduled to begin {formatMaintenanceDateTime(status.startsAt)}
        </p>
      )}
      {status.phase !== 'upcoming' && status.endsAt && (
        <p className="text-xs mt-1 text-amber-900/80">
          Expected back by {formatMaintenanceDateTime(status.endsAt)}
        </p>
      )}
    </div>
  )
}
