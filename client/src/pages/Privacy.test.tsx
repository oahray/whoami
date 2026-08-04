import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import Privacy from './Privacy'

describe('Privacy', () => {
  it('renders the privacy policy sections, preferences, and navigation links', () => {
    renderWithPreferences(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What we collect' })).toBeInTheDocument()
    expect(screen.getAllByText(/cloudflare web analytics/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Stored on your device' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How we use information' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByText(/report issues and share feedback shortly/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /your preferences/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Back to home')).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link', { name: /^about$/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /^about$/i })[0]).toHaveAttribute('href', '/about')
  })
})
