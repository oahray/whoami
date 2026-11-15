import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldShowWelcome, WELCOME_SEEN_KEY } from './firstRun'

const readStoredArchives = vi.fn()

vi.mock('./deviceArchiveIdb', () => ({
  readStoredArchives: () => readStoredArchives(),
}))

describe('shouldShowWelcome', () => {
  beforeEach(() => {
    localStorage.clear()
    readStoredArchives.mockResolvedValue([])
  })

  it('shows on a device with no games and no earlier welcome', async () => {
    expect(await shouldShowWelcome()).toBe(true)
  })

  it('does not show again once seen', async () => {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
    expect(await shouldShowWelcome()).toBe(false)
  })

  it.each(['whoami-solo-records', 'whoami-solo-mastery-v1', 'whoami-solo-daily-progress', 'whoami-in-person-deck'])(
    'skips and remembers a device that has played (%s)',
    async (key) => {
      localStorage.setItem(key, '{}')
      expect(await shouldShowWelcome()).toBe(false)
      expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1')
    },
  )

  it('skips a device that has only played online', async () => {
    readStoredArchives.mockResolvedValue([{ id: 'a' }])
    expect(await shouldShowWelcome()).toBe(false)
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1')
  })

  it('still shows to someone who visited before but never played', async () => {
    localStorage.setItem('whoami_nickname', 'Samuel')
    localStorage.setItem('whoami_theme', 'dark')
    expect(await shouldShowWelcome()).toBe(true)
  })
})
