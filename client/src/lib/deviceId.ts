/**
 * Random per-browser id sent when joining an online room. The server uses it only
 * so a host's two-kick ban still applies if the player changes nickname. It is not
 * derived from the device or browser, is never shown to other players, and is kept
 * by the server only as long as the room exists.
 */
const DEVICE_ID_KEY = 'whoami_device_id'
/** Must match the server's accepted format (server/src/sockets/handlers/utils.ts). */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

function randomId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 32)
}

/** Returns this browser's device id, creating and storing it on first use. Null if storage is unavailable. */
export function getDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing && DEVICE_ID_PATTERN.test(existing)) return existing
    const id = randomId()
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return null
  }
}
