import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import About from './About'

describe('About', () => {
  it('renders main sections, preferences, and a link back home', () => {
    renderWithPreferences(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who Am I?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Play online' })).toBeInTheDocument()
    expect(screen.getByText(/leave a lobby or live game at any time/i)).toBeInTheDocument()
    expect(screen.getByText(/kick a player/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pass & play' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Install the app' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Credits' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^oare arene$/i })[0]).toHaveAttribute(
      'href',
      'https://oarearene.com'
    )
    expect(screen.getByRole('link', { name: /^pixabay$/i })).toHaveAttribute(
      'href',
      'https://pixabay.com/'
    )
    expect(screen.getByRole('link', { name: /^pixabay content license$/i })).toHaveAttribute(
      'href',
      'https://pixabay.com/service/license/'
    )
    expect(screen.getByRole('link', { name: /^cc by 4\.0$/i })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/'
    )
    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByText(/report issues and share feedback shortly/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /your preferences/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /back to home/i })).toHaveLength(2)
    expect(screen.getByLabelText('Back to home')).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /^privacy$/i })).toHaveAttribute('href', '/privacy')
  })
})
