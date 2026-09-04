import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fadeOutMenuMusic,
  resetMenuMusicStateForTests,
  startMenuMusic,
  stopMenuMusic
} from './menuMusic'
import { DEFAULT_MUSIC_VOLUME } from './preferences'
import { unlockAudio, resetSoundStateForTests } from './sounds'

describe('menuMusic', () => {
  const playMock = vi.fn().mockResolvedValue(undefined)
  const pauseMock = vi.fn()

  beforeEach(() => {
    resetSoundStateForTests()
    resetMenuMusicStateForTests()
    localStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(() => ({
        preload: '',
        loop: false,
        volume: 1,
        paused: true,
        currentTime: 0,
        play: playMock,
        pause: pauseMock,
        addEventListener: vi.fn()
      }))
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    playMock.mockClear()
    pauseMock.mockClear()
  })

  it('does not start before audio unlock', () => {
    localStorage.setItem('whoami_music_volume', String(DEFAULT_MUSIC_VOLUME))
    startMenuMusic()
    expect(playMock).not.toHaveBeenCalled()
  })

  it('starts after unlock when music volume is positive', () => {
    localStorage.setItem('whoami_music_volume', String(DEFAULT_MUSIC_VOLUME))
    unlockAudio()
    startMenuMusic()
    expect(playMock).toHaveBeenCalled()
    const audio = vi.mocked(Audio).mock.results[0]?.value as { volume: number }
    expect(audio.volume).toBe(DEFAULT_MUSIC_VOLUME)
  })

  it('does not start when music volume is zero', () => {
    localStorage.setItem('whoami_music_volume', '0')
    unlockAudio()
    startMenuMusic()
    expect(playMock).not.toHaveBeenCalled()
  })

  it('starts with the soft default when music preference is unset', () => {
    unlockAudio()
    startMenuMusic()
    expect(playMock).toHaveBeenCalled()
    const audio = vi.mocked(Audio).mock.results[0]?.value as { volume: number }
    expect(audio.volume).toBe(DEFAULT_MUSIC_VOLUME)
  })

  it('stopMenuMusic pauses without resetting position', () => {
    localStorage.setItem('whoami_music_volume', String(DEFAULT_MUSIC_VOLUME))
    unlockAudio()
    startMenuMusic()
    const audio = vi.mocked(Audio).mock.results[0]?.value as {
      currentTime: number
      pause: typeof pauseMock
    }
    audio.currentTime = 12.5

    stopMenuMusic()

    expect(pauseMock).toHaveBeenCalled()
    expect(audio.currentTime).toBe(12.5)
  })

  it('fadeOutMenuMusic keeps position for later resume', () => {
    vi.useFakeTimers()
    localStorage.setItem('whoami_music_volume', String(DEFAULT_MUSIC_VOLUME))
    unlockAudio()
    startMenuMusic()
    const audio = vi.mocked(Audio).mock.results[0]?.value as {
      paused: boolean
      volume: number
      currentTime: number
      pause: typeof pauseMock
    }
    audio.paused = false
    audio.currentTime = 8

    fadeOutMenuMusic(200)
    vi.advanceTimersByTime(250)

    expect(pauseMock).toHaveBeenCalled()
    expect(audio.currentTime).toBe(8)
  })
})
