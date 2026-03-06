import { useGame } from '../hooks/useGame'

function ReconnectingIndicator() {
  const { isReconnecting } = useGame()

  if (!isReconnecting) return null

  return (
    <div className="fixed top-0 left-0 right-0 w-full bg-yellow-400/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2 z-50">
      <span className="material-symbols-outlined text-yellow-900 text-sm animate-pulse">sync</span>
      <p className="text-yellow-900 text-xs font-semibold uppercase tracking-wider">Reconnecting...</p>
    </div>
  )
}

export default ReconnectingIndicator
