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
    const button = screen.getByRole('button', { name: /mute sound effects/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toMatch(/text-primary/)
    expect(screen.getByText('volume_up')).toBeInTheDocument()
  })

  it('mutes sound effects and restores the last volume on unmute', () => {
    localStorage.setItem('whoami_sfx_volume', '0.4')
    localStorage.setItem('whoami_sfx_volume_last', '0.4')
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: /mute sound effects/i }))
    const muted = screen.getByRole('button', { name: /unmute sound effects/i })
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0')
    expect(muted).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('volume_off')).toBeInTheDocument()

    fireEvent.click(muted)
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0.4')
    expect(screen.getByRole('button', { name: /mute sound effects/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
