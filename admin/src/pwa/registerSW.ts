import { useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'

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
