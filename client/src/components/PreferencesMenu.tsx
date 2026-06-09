import { useEffect, useId, useRef, useState } from 'react'
import PreferencesForm from './PreferencesForm'

type PreferencesMenuProps = {
  className?: string
}

function PreferencesMenu({ className = '' }: PreferencesMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
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

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 md:size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        aria-label="Your preferences"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="material-symbols-outlined">tune</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Your preferences"
          className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
        >
          <h2 className="text-slate-900 text-sm font-bold mb-3">Your preferences</h2>
          <PreferencesForm idPrefix={menuId} />
        </div>
      )}
    </div>
  )
}

export default PreferencesMenu
