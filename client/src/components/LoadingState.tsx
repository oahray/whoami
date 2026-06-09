type LoadingStateProps = {
  /** Base message without trailing ellipsis (animated dots are added when enabled). */
  label?: string
  /** Centered full-area (default), horizontal row, or small hint line. */
  layout?: 'page' | 'inline' | 'compact'
  showSpinner?: boolean
  showEllipsis?: boolean
  className?: string
}

function PulsatingEllipsis({ className = '' }: { className?: string }) {
  const dotClass =
    'inline-block animate-loading-dot text-[1.1em] leading-none'
  return (
    <span className={`inline-flex min-w-[1.25em] ${className}`} aria-hidden>
      <span className={`${dotClass} [animation-delay:0ms]`}>.</span>
      <span className={`${dotClass} [animation-delay:160ms]`}>.</span>
      <span className={`${dotClass} [animation-delay:320ms]`}>.</span>
    </span>
  )
}

export default function LoadingState({
  label = 'Loading',
  layout = 'page',
  showSpinner = true,
  showEllipsis = true,
  className = '',
}: LoadingStateProps) {
  const textClass =
    layout === 'compact'
      ? 'text-xs text-foreground-muted'
      : layout === 'inline'
        ? 'text-sm font-medium'
        : 'text-sm font-medium text-foreground-muted'

  const spinnerClass =
    layout === 'compact'
      ? 'text-base text-primary'
      : layout === 'inline'
        ? 'text-lg text-current'
        : 'text-3xl text-primary'

  const layoutClass =
    layout === 'page'
      ? 'flex flex-1 flex-col items-center justify-center gap-3 p-8'
      : layout === 'inline'
        ? 'inline-flex items-center justify-center gap-2'
        : 'inline-flex items-center gap-1.5'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`${layoutClass} ${className}`.trim()}
    >
      {showSpinner && (
        <span
          className={`material-symbols-outlined animate-spin ${spinnerClass}`}
          aria-hidden
        >
          progress_activity
        </span>
      )}
      <span className={`${textClass} ${showEllipsis ? 'inline-flex items-baseline gap-0' : ''}`}>
        <span>{label}</span>
        {showEllipsis && <PulsatingEllipsis />}
      </span>
    </div>
  )
}
