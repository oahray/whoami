import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
import { stubMatchMedia } from '../test/matchMedia'
import PreferencesMenu from './PreferencesMenu'

function renderMenu() {
  return render(
    <PreferencesProvider>
      <PreferencesMenu />
    </PreferencesProvider>
  )
}

describe('PreferencesMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    stubMatchMedia()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens a dropdown with sound effects setting', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /your preferences/i }))
    expect(screen.getByRole('slider', { name: /sound effects/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^system$/i })).toBeInTheDocument()
  })

  it('closes when Escape is pressed', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /your preferences/i }))
    expect(screen.getByRole('dialog', { name: /your preferences/i })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /your preferences/i })).not.toBeInTheDocument()
  })
})
