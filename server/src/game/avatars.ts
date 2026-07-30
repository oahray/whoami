/** Predefined multiplayer avatar ids matching `client/public/avatars/avatar-XX.svg`. */
export const AVATAR_IDS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
  'avatar-09',
  'avatar-10',
  'avatar-11',
  'avatar-12',
  'avatar-13',
  'avatar-14',
  'avatar-15',
  'avatar-16',
  'avatar-17',
  'avatar-18',
  'avatar-19',
  'avatar-20',
  'avatar-21',
  'avatar-22',
  'avatar-23',
  'avatar-24'
] as const

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
