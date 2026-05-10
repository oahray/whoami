import { useGame } from '../hooks/useGame'

function ReconnectingIndicator() {
  const { isReconnecting } = useGame()

  if (!isReconnecting) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-yellow-400/95 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2"
    >
      <span className="material-symbols-outlined text-yellow-900 text-sm animate-pulse">sync</span>
      <p className="text-yellow-900 text-xs font-semibold uppercase tracking-wider">Reconnecting...</p>
    </div>
  )
}

export default ReconnectingIndicator
