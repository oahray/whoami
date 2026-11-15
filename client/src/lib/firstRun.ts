import { readStoredArchives } from './deviceArchiveIdb'

export const WELCOME_SEEN_KEY = 'whoami_welcome_seen'

// Each of these is written once a game is under way in that mode.
const PLAYED_KEYS = [
  'whoami-solo-records',
  'whoami-solo-mastery-v1',
  'whoami-solo-daily-progress',
  'whoami-in-person-deck',
]

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

function hasLocalPlayRecord(): boolean {
  return PLAYED_KEYS.some((key) => localStorage.getItem(key) !== null)
}

/** True until the player dismisses the card or has played a game in any mode. */
export async function shouldShowWelcome(): Promise<boolean> {
  try {
    if (localStorage.getItem(WELCOME_SEEN_KEY) === '1') return false
    if (hasLocalPlayRecord()) {
      markWelcomeSeen()
      return false
    }
  } catch {
    return false
  }
  // Online games leave no localStorage trace, only a signed archive.
  const archives = await readStoredArchives()
  if (archives.length > 0) {
    markWelcomeSeen()
    return false
  }
  return true
}
