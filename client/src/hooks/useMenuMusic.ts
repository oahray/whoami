import { useEffect } from 'react'
import { usePreferences } from '../context/PreferencesContext'
import {
  fadeOutMenuMusic,
  pauseMenuMusic,
  preloadMenuMusic,
  startMenuMusic,
  stopMenuMusic
} from '../lib/menuMusic'
import { isAudioUnlocked, unlockAudio, warmSoundCache } from '../lib/sounds'

/**
 * Soft theme loop while this screen is mounted (Lobby / setup).
 * Starts as soon as the screen opens when audio is already unlocked,
 * otherwise on the first pointer/key. Pauses when the tab/app is hidden.
 */
export function useMenuMusic(): void {
  const { musicAllowed } = usePreferences()

  useEffect(() => {
    preloadMenuMusic()
    warmSoundCache()

    if (!musicAllowed) {
      stopMenuMusic()
      return
    }

    const tryStart = () => {
      if (isAudioUnlocked()) startMenuMusic()
    }

    tryStart()

    const onGesture = () => {
      unlockAudio()
      warmSoundCache()
      startMenuMusic()
    }

    const onVisibility = () => {
      if (document.hidden) {
        pauseMenuMusic()
        return
      }
      tryStart()
    }

    const onPageHide = () => pauseMenuMusic()
    const onPageShow = () => tryStart()

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      fadeOutMenuMusic()
    }
  }, [musicAllowed])
}
