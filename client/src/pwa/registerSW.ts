import { useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'

/**
 * Service-worker registration + update flow.
 *
 * We avoid the virtual `virtual:pwa-register/react` module exported by
 * vite-plugin-pwa because the version we use leans on a Vite/Rollup plugin
 * filter API that Vite 5 doesn't fully honour at build time. Driving Workbox
 * directly is just as ergonomic and keeps everything explicit.
 *
 * The plugin still produces:
 *   - `/sw.js`        - the generated service worker
 *   - `/manifest.webmanifest` - auto-injected via index.html
 *   - precached static assets (icons, splash screens, JS/CSS bundles)
 */

const SW_URL = '/sw.js'

let workbox: Workbox | null = null
let registered = false

export function getWorkbox(): Workbox | null {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  if (workbox) return workbox
  workbox = new Workbox(SW_URL)
  return workbox
}

/**
 * React hook: returns whether a new SW is waiting to take control, and a
 * function to activate it (which reloads the page).
 *
 * We do NOT autoreload, because reloading mid-round would silently destroy
 * the player's lock state. Callers (see `UpdatePrompt`) decide when to prompt.
 */
export function useRegisterSW() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    const wb = getWorkbox()
    if (!wb) return

    const handleWaiting = () => setNeedRefresh(true)
    wb.addEventListener('waiting', handleWaiting)
    wb.addEventListener('externalwaiting', handleWaiting)

    if (!registered) {
      registered = true
      wb.register({ immediate: true }).catch((err) => {
        console.error('[pwa] SW registration failed:', err)
      })
    }

    return () => {
      wb.removeEventListener('waiting', handleWaiting)
      wb.removeEventListener('externalwaiting', handleWaiting)
    }
  }, [])

  const updateServiceWorker = (reload = true): Promise<void> => {
    const wb = getWorkbox()
    if (!wb) return Promise.resolve()

    return new Promise<void>((resolve) => {
      wb.addEventListener(
        'controlling',
        () => {
          if (reload) window.location.reload()
          resolve()
        },
        { once: true } as AddEventListenerOptions
      )
      void wb.messageSkipWaiting()
    })
  }

  return { needRefresh, setNeedRefresh, updateServiceWorker }
}
