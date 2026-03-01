import { useGame } from '../hooks/useGame'

function ReconnectingIndicator() {
  const { isReconnecting } = useGame()

  if (!isReconnecting) return null

  return (
    <div className="fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center gap-2">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
      <span>Reconnecting...</span>
    </div>
  )
}

export default ReconnectingIndicator
