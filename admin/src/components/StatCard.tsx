import type { ReactNode } from 'react'

type StatCardIconTone = 'primary' | 'success'
type StatCardLayout = 'auto' | 'stacked' | 'row'

type StatCardProps = {
  icon: string
  label: string
  value: ReactNode
  hint?: string
  iconTone?: StatCardIconTone
  valueClassName?: string
  /** `auto` stacks in narrow grids; `row` keeps value beside the label; `stacked` always stacks. */
  layout?: StatCardLayout
}

const iconToneClasses: Record<StatCardIconTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/15 text-emerald-700',
}

function StatCardIcon({ icon, iconTone }: { icon: string; iconTone: StatCardIconTone }) {
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${iconToneClasses[iconTone]}`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </div>
  )
}

function StatCardLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-admin-fg text-xs sm:text-sm font-medium leading-tight">{label}</p>
      {hint ? (
        <p className="text-admin-muted text-[11px] sm:text-xs leading-tight mt-px">{hint}</p>
      ) : null}
    </div>
  )
}

export default function StatCard({
  icon,
  label,
  value,
  hint,
  iconTone = 'primary',
  valueClassName = 'text-xl font-bold tabular-nums',
  layout = 'auto',
}: StatCardProps) {
  if (layout === 'row') {
    return (
      <div className="bg-admin-panel rounded-md border border-admin-border shadow-sm p-3 min-w-0 flex items-center gap-2.5">
        <StatCardIcon icon={icon} iconTone={iconTone} />
        <div className="min-w-0 flex-1">
          <StatCardLabel label={label} hint={hint} />
        </div>
        <p className={`text-admin-fg shrink-0 text-right ${valueClassName}`}>{value}</p>
      </div>
    )
  }

  const stacked = layout === 'stacked'

  return (
    <div
      className={`bg-admin-panel rounded-md border border-admin-border shadow-sm p-3 min-w-0 flex gap-1 ${
        stacked ? 'flex-col' : 'flex-col md:flex-row md:items-center md:gap-2.5'
      }`}
    >
      <div className={`flex items-center gap-2 min-w-0 ${stacked ? '' : 'md:flex-1'}`}>
        <StatCardIcon icon={icon} iconTone={iconTone} />
        <StatCardLabel label={label} hint={hint} />
      </div>
      <p
        className={`text-admin-fg min-w-0 ${valueClassName} ${
          stacked ? 'pl-10' : 'pl-10 md:pl-0 md:shrink-0 md:text-right'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
