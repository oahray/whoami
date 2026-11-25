/** Hex SHA-256 of a string. Catches damaged or half-copied files; there is no key involved. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function canCompress(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}

async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter()
  void writer.write(bytes)
  void writer.close()
  const chunks: Uint8Array[] = []
  const reader = stream.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return pipeThrough(bytes, new CompressionStream('gzip'))
}

export function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return pipeThrough(bytes, new DecompressionStream('gzip'))
}
