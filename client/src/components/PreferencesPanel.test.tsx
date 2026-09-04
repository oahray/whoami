import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from '../lib/preferences'
import { stubMatchMedia } from '../test/matchMedia'
import PreferencesPanel from './PreferencesPanel'

function renderPanel() {
  return render(
    <PreferencesProvider>
      <PreferencesPanel />
    </PreferencesProvider>
  )
}

describe('PreferencesPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    stubMatchMedia()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders sound effects slider at the soft default', () => {
    renderPanel()
    const slider = screen.getByRole('slider', { name: /sound effects/i })
    expect(slider).toHaveValue(String(Math.round(DEFAULT_SFX_VOLUME * 100)))
  })

  it('renders music slider at the soft default', () => {
    renderPanel()
    const slider = screen.getByRole('slider', { name: /^music$/i })
    expect(slider).toHaveValue(String(Math.round(DEFAULT_MUSIC_VOLUME * 100)))
  })

  it('persists when sound effects are muted', () => {
    renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: /sound effects/i }), {
      target: { value: '0' }
    })
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0')
    expect(screen.getByRole('slider', { name: /sound effects/i })).toHaveValue('0')
  })

  it('persists music volume changes', () => {
    renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: /^music$/i }), {
      target: { value: '35' }
    })
    expect(localStorage.getItem('whoami_music_volume')).toBe('0.35')
    expect(screen.getByRole('slider', { name: /^music$/i })).toHaveValue('35')
  })

  it('shows reduced motion notice when applicable', () => {
    stubMatchMedia({ reducedMotion: true })
    renderPanel()
    expect(screen.getByText(/reduce motion/i)).toBeInTheDocument()
  })

  it('persists dark theme and applies class to the document', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: /^dark$/i }))
    expect(localStorage.getItem('whoami_theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
