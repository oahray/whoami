import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { AdminThemeMode } from '../lib/theme'

const OPTIONS: { value: AdminThemeMode; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: 'brightness_auto' },
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
]

type ThemeMenuProps = {
  className?: string
  /** Sidebar variant uses light-on-dark chrome. */
  variant?: 'header' | 'sidebar'
}

function ThemeMenu({ className = '', variant = 'header' }: ThemeMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const { theme, setTheme } = useTheme()
  const active = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0]

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const triggerClass =
    variant === 'sidebar'
      ? 'text-admin-sidebar-muted hover:bg-admin-sidebar-hover hover:text-admin-sidebar-fg'
      : 'text-admin-muted hover:bg-admin-canvas'

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex size-9 items-center justify-center rounded-full transition-colors ${triggerClass}`}
        aria-label="Appearance"
        aria-expanded={open}
        aria-controls={menuId}
        title={`Appearance: ${active.label}`}
      >
        <span className="material-symbols-outlined">{active.icon}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Appearance"
          className={`absolute z-30 mt-2 w-40 rounded-lg border border-admin-border bg-admin-panel p-1 shadow-lg ${
            variant === 'sidebar' ? 'left-0 bottom-full mb-2' : 'right-0 top-full'
          }`}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              onClick={() => {
                setTheme(option.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                theme === option.value
                  ? 'bg-accent/15 text-accent'
                  : 'text-admin-fg hover:bg-admin-muted-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThemeMenu
