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

  it('shows volume on when sounds are enabled', () => {
    renderToggle()
    const button = screen.getByRole('button', { name: /mute sounds/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toMatch(/text-primary/)
    expect(screen.getByText('volume_up')).toBeInTheDocument()
  })

  it('mutes both sfx and music, then restores the pre-mute snapshot', () => {
    localStorage.setItem('whoami_sfx_volume', '0.4')
    localStorage.setItem('whoami_sfx_volume_last', '0.4')
    localStorage.setItem('whoami_music_volume', '0.1')
    localStorage.setItem('whoami_music_volume_last', '0.1')
    renderToggle()

    fireEvent.click(screen.getByRole('button', { name: /mute sounds/i }))
    const muted = screen.getByRole('button', { name: /unmute sounds/i })
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0')
    expect(localStorage.getItem('whoami_music_volume')).toBe('0')
    expect(muted).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('volume_off')).toBeInTheDocument()

    fireEvent.click(muted)
    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0.4')
    expect(localStorage.getItem('whoami_music_volume')).toBe('0.1')
    expect(screen.getByRole('button', { name: /mute sounds/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('keeps music muted on unmute if it was already off when muted', () => {
    localStorage.setItem('whoami_sfx_volume', '0.7')
    localStorage.setItem('whoami_sfx_volume_last', '0.7')
    localStorage.setItem('whoami_music_volume', '0')
    localStorage.setItem('whoami_music_volume_last', '0.1')
    renderToggle()

    fireEvent.click(screen.getByRole('button', { name: /mute sounds/i }))
    fireEvent.click(screen.getByRole('button', { name: /unmute sounds/i }))

    expect(localStorage.getItem('whoami_sfx_volume')).toBe('0.7')
    expect(localStorage.getItem('whoami_music_volume')).toBe('0')
  })
})
