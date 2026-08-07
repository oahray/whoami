import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildInviteUrl,
  canUseNativeShare,
  normalizeRoomCode,
  parseRoomCodeInput,
  shareOrCopyInvite
} from './roomCode'

describe('roomCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes bare codes', () => {
    expect(normalizeRoomCode('ab12cd')).toBe('AB12CD')
    expect(normalizeRoomCode('ab-12 cd!!')).toBe('AB12CD')
    expect(normalizeRoomCode('ABCDEFGH')).toBe('ABCDEF')
  })

  it('parses invite URLs and query fragments into a room code', () => {
    expect(parseRoomCodeInput('https://play.example.com/?room=ab12cd')).toBe('AB12CD')
    expect(parseRoomCodeInput('play.example.com/?room=xy99zz')).toBe('XY99ZZ')
    expect(parseRoomCodeInput('?room=hello1')).toBe('HELLO1')
    expect(parseRoomCodeInput('Join here: https://x.test/path?room=q1w2e3&x=1')).toBe('Q1W2E3')
    expect(parseRoomCodeInput('abc123')).toBe('ABC123')
  })

  it('builds invite urls', () => {
    expect(buildInviteUrl('ab12cd', 'https://play.example.com')).toBe(
      'https://play.example.com/?room=AB12CD'
    )
  })

  it('shares via the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })

    await expect(shareOrCopyInvite('ABC123', 'https://play.example.com')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({
      title: 'Who Am I?',
      text: 'Join my Who Am I? room (ABC123)',
      url: 'https://play.example.com/?room=ABC123'
    })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(canUseNativeShare()).toBe(true)
  })

  it('copies the invite link when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(shareOrCopyInvite('ABC123', 'https://play.example.com')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://play.example.com/?room=ABC123')
  })

  it('rethrows when the user cancels the share sheet', async () => {
    const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' })
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(abort),
      clipboard: { writeText: vi.fn() }
    })

    await expect(shareOrCopyInvite('ABC123', 'https://play.example.com')).rejects.toMatchObject({
      name: 'AbortError'
    })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})
