import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vibrate } from './haptics'
import { writeVibrationEnabled } from './preferences'

describe('vibrate', () => {
  let buzz: ReturnType<typeof vi.fn<[VibratePattern], boolean>>

  beforeEach(() => {
    localStorage.clear()
    buzz = vi.fn<[VibratePattern], boolean>(() => true)
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: buzz })
  })

  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('buzzes by default where the device supports it', () => {
    vibrate('correct')
    expect(buzz).toHaveBeenCalledTimes(1)
  })

  it('stays still once the player turns it off', () => {
    writeVibrationEnabled(false)
    vibrate('wrong')
    expect(buzz).not.toHaveBeenCalled()
  })

  it('does nothing on devices without vibration', () => {
    delete (navigator as { vibrate?: unknown }).vibrate
    expect(() => vibrate('timeout')).not.toThrow()
  })
})
