import { useEffect } from 'react'
import { usePreferences } from '../context/PreferencesContext'
import {
  fadeOutMenuMusic,
  startMenuMusic,
  stopMenuMusic
} from '../lib/menuMusic'
import { isAudioUnlocked, unlockAudio } from '../lib/sounds'

/**
 * Soft theme loop while this screen is mounted (Lobby / setup).
 * Starts after audio unlock (prior gesture) or the first pointer/key on the page.
 * Pauses on leave / music-off and resumes from the same position when you return.
 */
export function useMenuMusic(): void {
  const { musicAllowed } = usePreferences()

  useEffect(() => {
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
      startMenuMusic()
    }

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)

    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      fadeOutMenuMusic()
    }
  }, [musicAllowed])
}
