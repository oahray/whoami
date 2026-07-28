import { useEffect, useState, type CSSProperties } from 'react'

type VisualViewportFrame = {
  top: number
  height: number
}

const MOBILE_LOCK_QUERY = '(max-width: 1023px)'

/**
 * Pin a full-screen game shell to the *visual* viewport on small screens.
 *
 * iOS Safari keeps the layout viewport tall when the keyboard opens and only
 * shrinks/offsets the visual viewport. Padding by keyboard height on top of
 * that scroll often leaves a dead gap above the keyboard. Matching the shell
 * to visualViewport height + offsetTop keeps the footer flush with the keys.
 *
 * Desktop (`lg+`) returns no lock styles so normal document flow is unchanged.
 */
export function useVisualViewportLock(): CSSProperties {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_LOCK_QUERY).matches : false
  )
  const [frame, setFrame] = useState<VisualViewportFrame>(() => ({
    top: 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }))

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LOCK_QUERY)
    const syncEnabled = () => setEnabled(mq.matches)
    syncEnabled()
    mq.addEventListener('change', syncEnabled)
    return () => mq.removeEventListener('change', syncEnabled)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const vv = window.visualViewport
    const sync = () => {
      if (!vv) {
        setFrame({ top: 0, height: window.innerHeight })
        return
      }
      setFrame({
        top: vv.offsetTop,
        height: vv.height
      })
    }

    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)

    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [enabled])

  if (!enabled) return {}

  return {
    position: 'fixed',
    top: frame.top,
    left: 0,
    right: 0,
    height: frame.height,
    width: '100%'
  }
}
