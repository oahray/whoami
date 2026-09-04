import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAudioUnlocked,
  playSound,
  resetSoundStateForTests,
  unlockAudio
} from './sounds'

describe('sounds', () => {
  const playMock = vi.fn().mockResolvedValue(undefined)
  let lastAudio: { volume: number; play: typeof playMock }

  beforeEach(() => {
    resetSoundStateForTests()
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
      vi.fn().mockImplementation(() => {
        lastAudio = {
          volume: 1,
          play: playMock
        }
        return {
          preload: '',
          currentTime: 0,
          get volume() {
            return lastAudio.volume
          },
          set volume(value: number) {
            lastAudio.volume = value
          },
          play: playMock,
          addEventListener: vi.fn()
        }
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    playMock.mockClear()
  })

  it('does not play before unlockAudio', () => {
    playSound('correct')
    expect(playMock).not.toHaveBeenCalled()
  })

  it('does not play when sound effects volume is zero', () => {
    localStorage.setItem('whoami_sfx_volume', '0')
    unlockAudio()
    playSound('correct')
    expect(playMock).not.toHaveBeenCalled()
  })

  it('plays after unlock when enabled and applies volume', () => {
    localStorage.setItem('whoami_sfx_volume', '0.4')
    unlockAudio()
    playSound('correct')
    expect(playMock).toHaveBeenCalled()
    expect(lastAudio.volume).toBe(0.4)
    expect(isAudioUnlocked()).toBe(true)
  })

  it('marks missing files unavailable on error event', () => {
    unlockAudio()
    let errorHandler: (() => void) | undefined
    vi.mocked(Audio).mockImplementation(() => ({
      preload: '',
      currentTime: 0,
      volume: 1,
      play: playMock,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'error') errorHandler = handler
      }
    }))

    playSound('go')
    expect(playMock).toHaveBeenCalledTimes(1)

    errorHandler?.()
    playMock.mockClear()
    playSound('go')
    expect(playMock).not.toHaveBeenCalled()
  })
})
