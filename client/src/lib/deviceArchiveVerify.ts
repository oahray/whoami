import { API_BASE_URL } from './apiBase'
import {
  HISTORY_ARCHIVE_ALG,
  serializeHistoryArchivePayload,
  type SignedHistoryArchive
} from './historyArchivePayload'

type PublicKeyResponse = {
  alg: string
  kid: string
  publicKey: string
}

let cachedKey: CryptoKey | null = null
let cachedKeyPromise: Promise<CryptoKey | null> | null = null

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function importSpkiKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(spkiBase64),
    { name: HISTORY_ARCHIVE_ALG },
    false,
    ['verify']
  )
}

export async function fetchHistoryVerifyKey(): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey
  if (cachedKeyPromise) return cachedKeyPromise
  cachedKeyPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/history-public-key`)
      if (!response.ok) return null
      const body = (await response.json()) as PublicKeyResponse
      if (!body?.publicKey || body.alg !== HISTORY_ARCHIVE_ALG) return null
      cachedKey = await importSpkiKey(body.publicKey)
      return cachedKey
    } catch {
      return null
    } finally {
      cachedKeyPromise = null
    }
  })()
  return cachedKeyPromise
}

export function resetHistoryVerifyKeyCacheForTests(): void {
  cachedKey = null
  cachedKeyPromise = null
}

export async function verifySignedHistoryArchive(
  archive: SignedHistoryArchive,
  key?: CryptoKey | null
): Promise<boolean> {
  const verifyKey = key === undefined ? await fetchHistoryVerifyKey() : key
  if (!verifyKey) return false
  try {
    const data = new TextEncoder().encode(serializeHistoryArchivePayload(archive.payload))
    const signature = base64ToBytes(archive.signature)
    return await crypto.subtle.verify({ name: HISTORY_ARCHIVE_ALG }, verifyKey, signature, data)
  } catch {
    return false
  }
}
