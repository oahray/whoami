import { useEffect, useState } from 'react'

const STORAGE_KEY = 'whoami_dismiss_ios_install_hint'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

/**
 * iOS has no "Install app" banner (unlike Chrome on Android). Installation is
 * always manual: Safari → Share → Add to Home Screen. This hint only shows on
 * iOS when the page is still in the browser, not when launched from the home screen.
 */
export default function IosInstallHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!isIOS() || isStandalonePWA()) return
      if (localStorage.getItem(STORAGE_KEY) === '1') return
      setVisible(true)
    } catch {
      /* localStorage unavailable */
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div className="w-full bg-white/20 backdrop-blur-sm border-b border-white/25 px-4 py-3 flex items-start gap-3">
      <span className="material-symbols-outlined text-white text-xl shrink-0 mt-0.5">share</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-snug">Install on your Home Screen</p>
        <p className="text-white/90 text-xs mt-1 leading-relaxed">
          Tap <span className="font-bold">Share</span> in your browser toolbar, then scroll and tap{' '}
          <span className="font-bold">Add to Home Screen</span>.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-white/90 hover:text-white text-xs font-semibold shrink-0 px-2 py-1 rounded-md hover:bg-white/10"
      >
        OK
      </button>
    </div>
  )
}
