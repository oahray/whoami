import { isMusicPlaybackAllowed, readMusicEnabled } from './preferences'
import { isAudioUnlocked, unlockAudio } from './sounds'

/** Soft menu theme loop. Drop the file at `public/sounds/theme.mp3`. */
export const THEME_MUSIC_PATH = '/sounds/theme.mp3'

/** Keep theme quieter than SFX so voice lines stay clear. */
const THEME_VOLUME = 0.22
const FADE_MS = 700

let themeAudio: HTMLAudioElement | null = null
let themeUnavailable = false
let fadeTimer: ReturnType<typeof setInterval> | null = null

function clearFade(): void {
  if (fadeTimer) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

function getThemeAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || themeUnavailable) return null

  if (!themeAudio) {
    themeAudio = new Audio(THEME_MUSIC_PATH)
    themeAudio.loop = true
    themeAudio.preload = 'auto'
    themeAudio.volume = THEME_VOLUME
    themeAudio.addEventListener(
      'error',
      () => {
        themeUnavailable = true
        themeAudio = null
      },
      { once: true }
    )
  }
  return themeAudio
}

function canPlayTheme(): boolean {
  if (typeof window === 'undefined') return false
  if (!isAudioUnlocked()) return false
  if (!isMusicPlaybackAllowed(readMusicEnabled())) return false
  if (themeUnavailable) return false
  return true
}

/** Start or resume the menu theme if prefs / unlock allow. Missing file is skipped. */
export function startMenuMusic(): void {
  if (!canPlayTheme()) return

  const audio = getThemeAudio()
  if (!audio) return

  clearFade()
  audio.volume = THEME_VOLUME

  try {
    if (audio.paused) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        void playPromise.catch(() => {
          // Autoplay blocked or missing file
        })
      }
    }
  } catch {
    // ignore
  }
}

/** Pause without resetting position so re-enable / return can resume. */
export function stopMenuMusic(): void {
  clearFade()
  if (!themeAudio) return
  try {
    themeAudio.pause()
    themeAudio.volume = THEME_VOLUME
  } catch {
    // ignore
  }
}

/** Soft fade-out before leaving a menu screen; keeps playback position. */
export function fadeOutMenuMusic(durationMs = FADE_MS): void {
  const audio = themeAudio
  if (!audio || audio.paused) {
    stopMenuMusic()
    return
  }

  clearFade()
  const startVolume = audio.volume
  const startedAt = Date.now()

  fadeTimer = setInterval(() => {
    const elapsed = Date.now() - startedAt
    const t = Math.min(1, elapsed / durationMs)
    audio.volume = startVolume * (1 - t)
    if (t >= 1) {
      clearFade()
      try {
        audio.pause()
        audio.volume = THEME_VOLUME
      } catch {
        // ignore
      }
    }
  }, 40)
}

/** Enable music from a user gesture and attempt playback. */
export function enableAndStartMenuMusic(): void {
  unlockAudio()
  startMenuMusic()
}

/** Reset internal state (tests only). */
export function resetMenuMusicStateForTests(): void {
  clearFade()
  if (themeAudio) {
    try {
      themeAudio.pause()
    } catch {
      // ignore
    }
  }
  themeAudio = null
  themeUnavailable = false
}
