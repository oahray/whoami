/** Predefined multiplayer avatar ids matching `/avatars/avatar-XX.svg`. */
export const AVATAR_COUNT = 60

export const AVATAR_IDS = Array.from({ length: AVATAR_COUNT }, (_, index) => {
  const n = String(index + 1).padStart(2, '0')
  return `avatar-${n}` as const
})

export type AvatarId = (typeof AVATAR_IDS)[number]

export const AVATAR_STORAGE_KEY = 'whoami_avatar'

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value)
}

export function pickRandomAvatarId(): AvatarId {
  const index = Math.floor(Math.random() * AVATAR_IDS.length)
  return AVATAR_IDS[index] ?? AVATAR_IDS[0]
}

export function avatarSrc(avatarId: AvatarId): string {
  return `/avatars/${avatarId}.svg`
}

export function readStoredAvatarId(): AvatarId | null {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    return isAvatarId(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeStoredAvatarId(avatarId: AvatarId): void {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, avatarId)
  } catch {
    // ignore quota / private mode
  }
}

export function coerceAvatarId(raw: unknown): AvatarId {
  return isAvatarId(raw) ? raw : pickRandomAvatarId()
}
