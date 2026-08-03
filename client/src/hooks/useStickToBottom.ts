import { useCallback, useEffect, useRef } from 'react'

const NEAR_BOTTOM_PX = 48

/**
 * Chat-style sticky scroll: auto-scroll to bottom when the user is already
 * near the bottom; stop while they scroll up; resume when they return.
 */
export function useStickToBottom<T extends HTMLElement = HTMLElement>(scrollDeps: unknown[]) {
  const ref = useRef<T | null>(null)
  const stickRef = useRef(true)

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickRef.current = distance <= NEAR_BOTTOM_PX
  }, [])

  const resetStick = useCallback(() => {
    stickRef.current = true
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !stickRef.current) return
    el.scrollTop = el.scrollHeight
    // Caller supplies content deps that should trigger a stick-to-bottom scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, scrollDeps)

  return { ref, onScroll, resetStick }
}
