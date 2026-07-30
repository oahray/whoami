import { isSfxPlaybackAllowed, readSfxEnabled } from './preferences'

/** Matches filenames in `public/sounds/` (without extension). */
export type SoundId =
  | 'go'
  | 'clue-pop'
  | 'correct'
  | 'uh-oh'
  | 'card-flip'
  | 'player-join'
  | 'player-kick'
  | 'yay'

const SOUND_PATHS: Record<SoundId, string> = {
  go: '/sounds/go.mp3',
  'clue-pop': '/sounds/clue-pop.mp3',
  correct: '/sounds/correct.mp3',
  'uh-oh': '/sounds/uh-oh.mp3',
  'card-flip': '/sounds/card-flip.mp3',
  'player-join': '/sounds/player-join.mp3',
  'player-kick': '/sounds/player-kick.mp3',
  yay: '/sounds/yay.mp3'
}

const THROTTLE_MS: Partial<Record<SoundId, number>> = {
  'clue-pop': 400,
  'player-join': 500,
  'player-kick': 500
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
          // Autoplay blocked or missing file; ignore
        })
    }
  } catch {
    // ignore
  }
}
