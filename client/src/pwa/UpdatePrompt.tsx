import { useEffect, useState } from 'react'
import { useGame } from '../hooks/useGame'
import { useRegisterSW } from './registerSW'

/**
 * Service-worker update prompt.
 *
 * Why bother with a prompt instead of `registerType: 'autoUpdate'`?
 * Because the game is real-time and a forced reload mid-round would silently
 * drop the player's lock state and timer. So we:
 *   1. Register a service worker that waits when an update is available.
 *   2. Defer prompting the user while a round is in flight.
 *   3. Once they're back in a calm state (home / lobby / between rounds),
 *      show a small bottom-sheet giving them a one-tap "Update".
 *
 * If you want a no-prompt experience for admins or non-game routes you can
 * call `updateServiceWorker(true)` directly - that triggers the reload.
 */
export default function UpdatePrompt() {
  const { gameState } = useGame()
  const [dismissed, setDismissed] = useState(false)

  const { needRefresh, setNeedRefresh, updateServiceWorker } = useRegisterSW()

  // Reset dismissal when a new update arrives so subsequent updates can prompt again.
  useEffect(() => {
    if (needRefresh) setDismissed(false)
  }, [needRefresh])

  if (!needRefresh || dismissed) return null

  // Defer the prompt while a round is actively in flight; surface it again
  // when the player is back in a safe state.
  const inLiveRound =
    gameState?.phase === 'starting' ||
    gameState?.phase === 'active' ||
    gameState?.phase === 'clue_revealed'

  if (inLiveRound) return null

  const handleUpdate = () => {
    void updateServiceWorker(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setNeedRefresh(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 mx-auto max-w-md z-50 bg-surface border border-edge shadow-2xl rounded-lg p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm font-bold">A new version is available</p>
        <p className="text-foreground-muted text-xs mt-0.5">Refresh now to get the latest version of Who Am I?</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-foreground-muted hover:text-foreground text-xs px-2 py-1 font-medium"
      >
        Later
      </button>
      <button
        type="button"
        onClick={handleUpdate}
        className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
      >
        Update
      </button>
    </div>
  )
}
