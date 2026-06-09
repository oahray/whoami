import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAudioUnlocked,
  playSound,
  resetSoundStateForTests,
  unlockAudio
} from './sounds'

describe('sounds', () => {
  const playMock = vi.fn().mockResolvedValue(undefined)

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
      vi.fn().mockImplementation(() => ({
        preload: '',
        currentTime: 0,
        play: playMock,
        addEventListener: vi.fn()
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    playMock.mockClear()
  })

  it('does not play before unlockAudio', () => {
    playSound('success-small')
    expect(playMock).not.toHaveBeenCalled()
  })

  it('does not play when sound effects are disabled', () => {
    localStorage.setItem('whoami_sfx_enabled', 'false')
    unlockAudio()
    playSound('success-small')
    expect(playMock).not.toHaveBeenCalled()
  })

  it('plays after unlock when enabled', () => {
    unlockAudio()
    playSound('success-small')
    expect(playMock).toHaveBeenCalled()
    expect(isAudioUnlocked()).toBe(true)
  })

  it('marks missing files unavailable on error event', () => {
    unlockAudio()
    let errorHandler: (() => void) | undefined
    vi.mocked(Audio).mockImplementation(() => ({
      preload: '',
      currentTime: 0,
      play: playMock,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'error') errorHandler = handler
      }
    }))

    playSound('round-start')
    expect(playMock).toHaveBeenCalledTimes(1)

    errorHandler?.()
    playMock.mockClear()
    playSound('round-start')
    expect(playMock).not.toHaveBeenCalled()
  })
})
