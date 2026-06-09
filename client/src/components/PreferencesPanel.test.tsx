import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../context/PreferencesContext'
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
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
  })

  it('renders sound effects toggle defaulting to on', () => {
    renderPanel()
    const checkbox = screen.getByRole('checkbox', { name: /sound effects/i })
    expect(checkbox).toBeChecked()
  })

  it('persists when toggled off', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: /sound effects/i }))
    expect(screen.getByRole('checkbox', { name: /sound effects/i })).not.toBeChecked()
    expect(localStorage.getItem('whoami_sfx_enabled')).toBe('false')
  })

  it('shows reduced motion notice when applicable', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    renderPanel()
    expect(screen.getByText(/reduce motion/i)).toBeInTheDocument()
  })
})
