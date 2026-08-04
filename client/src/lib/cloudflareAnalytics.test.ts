import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCloudflareAnalytics } from './cloudflareAnalytics'

describe('initCloudflareAnalytics', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    vi.unstubAllEnvs()
  })

  it('does nothing when the token is unset', () => {
    vi.stubEnv('VITE_CF_ANALYTICS_TOKEN', '')
    initCloudflareAnalytics()
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull()
  })

  it('injects the Cloudflare beacon with spa enabled', () => {
    vi.stubEnv('VITE_CF_ANALYTICS_TOKEN', 'test-token-abc')
    initCloudflareAnalytics()
    const script = document.querySelector('script[data-cf-beacon]') as HTMLScriptElement | null
    expect(script).not.toBeNull()
    expect(script?.src).toContain('static.cloudflareinsights.com/beacon.min.js')
    expect(script?.defer).toBe(true)
    expect(script?.getAttribute('data-cf-beacon')).toBe(
      JSON.stringify({ token: 'test-token-abc', spa: true })
    )
  })

  it('does not inject twice', () => {
    vi.stubEnv('VITE_CF_ANALYTICS_TOKEN', 'test-token-abc')
    initCloudflareAnalytics()
    initCloudflareAnalytics()
    expect(document.querySelectorAll('script[data-cf-beacon]')).toHaveLength(1)
  })
})
