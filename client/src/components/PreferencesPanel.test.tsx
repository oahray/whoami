import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
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

  it('renders sound effects toggle defaulting to on', () => {
    renderPanel()
    const checkbox = screen.getByRole('checkbox', { name: /sound effects/i })
    expect(checkbox).toBeChecked()
  })

  it('renders music toggle defaulting to on', () => {
    renderPanel()
    const checkbox = screen.getByRole('checkbox', { name: /^music$/i })
    expect(checkbox).toBeChecked()
  })

  it('persists when toggled off', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: /sound effects/i }))
    expect(screen.getByRole('checkbox', { name: /sound effects/i })).not.toBeChecked()
    expect(localStorage.getItem('whoami_sfx_enabled')).toBe('false')
  })

  it('persists music when toggled off', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: /^music$/i }))
    expect(screen.getByRole('checkbox', { name: /^music$/i })).not.toBeChecked()
    expect(localStorage.getItem('whoami_music_enabled')).toBe('false')
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
