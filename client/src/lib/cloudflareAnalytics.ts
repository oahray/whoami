/**
 * Cloudflare Web Analytics (cookieless beacon).
 * Set `VITE_CF_ANALYTICS_TOKEN` in client env for production builds.
 * Leave unset locally to skip loading the script.
 */
export function initCloudflareAnalytics(): void {
  const token = String(import.meta.env.VITE_CF_ANALYTICS_TOKEN ?? '').trim()
  if (!token || typeof document === 'undefined') return
  if (document.querySelector('script[data-cf-beacon]')) return

  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  script.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }))
  document.head.appendChild(script)
}
