import { useEffect, useState } from 'react'
import { useRegisterSW } from './registerSW'

export default function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false)
  const { needRefresh, setNeedRefresh, updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    if (needRefresh) setDismissed(false)
  }, [needRefresh])

  if (!needRefresh || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 mx-auto max-w-md z-50 bg-white border border-slate-200 shadow-2xl rounded-lg p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 text-sm font-bold">A new version is available</p>
        <p className="text-slate-600 text-xs mt-0.5">Refresh to get the latest admin build.</p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-slate-500 hover:text-slate-700 text-xs px-2 py-1 font-medium"
      >
        Later
      </button>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
      >
        Update
      </button>
    </div>
  )
}
