import { isSfxPlaybackAllowed, readSfxEnabled } from './preferences'

/** Matches filenames in `public/sounds/` (without extension). */
export type SoundId =
  | 'ui-click'
  | 'ui-error'
  | 'success-small'
  | 'round-start'
  | 'clue-reveal'
  | 'round-end'
  | 'game-win'
  | 'card-flip'

const SOUND_PATHS: Record<SoundId, string> = {
  'ui-click': '/sounds/ui-click.mp3',
  'ui-error': '/sounds/ui-error.mp3',
  'success-small': '/sounds/success-small.mp3',
  'round-start': '/sounds/round-start.mp3',
  'clue-reveal': '/sounds/clue-reveal.mp3',
  'round-end': '/sounds/round-end.mp3',
  'game-win': '/sounds/game-win.mp3',
  'card-flip': '/sounds/card-flip.mp3'
}

const THROTTLE_MS: Partial<Record<SoundId, number>> = {
  'clue-reveal': 400,
  'ui-error': 600
}

let audioUnlocked = false
const cache = new Map<SoundId, HTMLAudioElement>()
const unavailable = new Set<SoundId>()
const lastPlayedAt = new Map<SoundId, number>()

/** Call from a user gesture (join, start cards, etc.) so later socket-driven sounds can play. */
export function unlockAudio(): void {
  audioUnlocked = true
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked
}

/** Reset internal state (tests only). */
export function resetSoundStateForTests(): void {
  audioUnlocked = false
  cache.clear()
  unavailable.clear()
  lastPlayedAt.clear()
}

function shouldPlay(id: SoundId): boolean {
  if (typeof window === 'undefined') return false
  if (!audioUnlocked) return false
  if (!isSfxPlaybackAllowed(readSfxEnabled())) return false
  if (unavailable.has(id)) return false

  const throttle = THROTTLE_MS[id]
  if (throttle) {
    const last = lastPlayedAt.get(id) ?? 0
    if (Date.now() - last < throttle) return false
  }

  return true
}

function getAudio(id: SoundId): HTMLAudioElement | null {
  if (unavailable.has(id)) return null

  let audio = cache.get(id)
  if (!audio) {
    audio = new Audio(SOUND_PATHS[id])
    audio.preload = 'auto'
    audio.addEventListener(
      'error',
      () => {
        unavailable.add(id)
        cache.delete(id)
      },
      { once: true }
    )
    cache.set(id, audio)
  }
  return audio
}

/**
 * Play a sound if prefs allow, audio is unlocked, and the file exists.
 * Missing files are remembered and skipped silently thereafter.
 */
export function playSound(id: SoundId): void {
  if (!shouldPlay(id)) return

  const audio = getAudio(id)
  if (!audio) return

  try {
    audio.currentTime = 0
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      void playPromise
        .then(() => {
          lastPlayedAt.set(id, Date.now())
        })
        .catch(() => {
          // Autoplay blocked or missing file — do not throw
        })
    }
  } catch {
    // ignore
  }
}
