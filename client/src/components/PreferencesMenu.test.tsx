import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
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
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
  })

  it('opens a dropdown with sound effects setting', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /your preferences/i }))
    expect(screen.getByRole('dialog', { name: /your preferences/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /sound effects/i })).toBeInTheDocument()
  })

  it('closes when Escape is pressed', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /your preferences/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /your preferences/i })).not.toBeInTheDocument()
  })
})
