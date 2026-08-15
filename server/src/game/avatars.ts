/** Seeded DiceBear Adventurer Neutral faces (`avatar-01` … `avatar-48`). */
export const AVATAR_COUNT = 60

export const AVATAR_IDS = Array.from({ length: AVATAR_COUNT }, (_, index) => {
  const n = String(index + 1).padStart(2, '0')
  return `avatar-${n}` as const
})

export type AvatarId = (typeof AVATAR_IDS)[number]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value)
}

export function pickRandomAvatarId(): AvatarId {
  const index = Math.floor(Math.random() * AVATAR_IDS.length)
  return AVATAR_IDS[index] ?? AVATAR_IDS[0]
}

/** Accept a known id, otherwise assign a random one. */
export function coerceAvatarId(raw: unknown): AvatarId {
  return isAvatarId(raw) ? raw : pickRandomAvatarId()
}
