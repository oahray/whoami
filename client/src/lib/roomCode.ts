/** Multiplayer room codes are 6 alphanumeric characters (server-generated). */
export const ROOM_CODE_LENGTH = 6

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH)
}

/**
 * Accept a bare room code or an invite URL / pasted text and return a
 * normalized 6-character code (or a shorter prefix while the user is typing).
 */
export function parseRoomCodeInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const fromQuery = extractRoomQueryParam(trimmed)
  if (fromQuery) return normalizeRoomCode(fromQuery)

  return normalizeRoomCode(trimmed)
}

function extractRoomQueryParam(raw: string): string | null {
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
    const url = new URL(candidate)
    const room = url.searchParams.get('room')
    if (room) return room
  } catch {
    // not a URL
  }

  const match = raw.match(/[?&#]room=([A-Za-z0-9]+)/i) ?? raw.match(/(?:^|[\s/])room=([A-Za-z0-9]+)/i)
  return match?.[1] ?? null
}

export function buildInviteUrl(roomCode: string, origin: string): string {
  return `${origin}/?room=${normalizeRoomCode(roomCode)}`
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Prefer the system share sheet; fall back to copying the invite link.
 * Re-throws AbortError when the user cancels the share sheet.
 */
export async function shareOrCopyInvite(
  roomCode: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): Promise<'shared' | 'copied'> {
  const url = buildInviteUrl(roomCode, origin)
  if (canUseNativeShare()) {
    try {
      await navigator.share({
        title: 'Who Am I?',
        text: `Join my Who Am I? room (${normalizeRoomCode(roomCode)})`,
        url
      })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      // Unsupported payload or share failure — copy instead
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
