import { useEffect } from 'react'

/** Keeps the screen on while `active`, where the browser supports it. Silently does nothing otherwise. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let requesting = false
    let stopped = false

    const acquire = async () => {
      if (stopped || sentinel || requesting || document.visibilityState !== 'visible') return
      requesting = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (stopped) {
          void lock.release()
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // Refused, for example by battery saver. The game works the same without it.
      } finally {
        requesting = false
      }
    }

    // Browsers drop the lock whenever the page is hidden, so take it again on return.
    const onVisibilityChange = () => {
      void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
      sentinel = null
    }
  }, [active])
}
