import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import {
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
  musicPercentToVolume,
  musicVolumeToPercent,
  sfxVolumeToPercent
} from '../lib/preferences'
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
    expect(slider).toHaveValue(String(sfxVolumeToPercent(DEFAULT_SFX_VOLUME)))
  })

  it('renders music slider at the soft default', () => {
    renderPanel()
    const slider = screen.getByRole('slider', { name: /^music$/i })
    expect(slider).toHaveValue(String(musicVolumeToPercent(DEFAULT_MUSIC_VOLUME)))
  })

  it('persists when sound effects are muted', () => {
    renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: /sound effects/i }), {
      target: { value: '0' }
    })
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0')
    expect(screen.getByRole('slider', { name: /sound effects/i })).toHaveValue('0')
  })

  it('persists music volume changes using the soft absolute range', () => {
    renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: /^music$/i }), {
      target: { value: '100' }
    })
    expect(localStorage.getItem('whoami_music_volume')).toBe(String(musicPercentToVolume(100)))
    expect(screen.getByRole('slider', { name: /^music$/i })).toHaveValue('100')
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
