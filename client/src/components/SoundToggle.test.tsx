import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { stubMatchMedia } from '../test/matchMedia'
import SoundToggle from './SoundToggle'

function renderToggle() {
  return render(
    <PreferencesProvider>
      <SoundToggle />
    </PreferencesProvider>
  )
}

describe('SoundToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows volume on when sound effects are enabled', () => {
    renderToggle()
    const button = screen.getByRole('button', { name: /turn sound effects off/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toMatch(/text-primary/)
    expect(screen.getByText('volume_up')).toBeInTheDocument()
  })

  it('toggles sound off and shows volume off icon', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: /turn sound effects off/i }))
    const button = screen.getByRole('button', { name: /turn sound effects on/i })
    expect(localStorage.getItem('whoami_sfx_enabled')).toBe('false')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).toMatch(/text-foreground-muted/)
    expect(screen.getByText('volume_off')).toBeInTheDocument()
  })
})
