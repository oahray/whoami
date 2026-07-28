import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import About from './About'

describe('About', () => {
  it('renders main sections and a link back home', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who Am I?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Play online' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Party mode' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Install the app' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /back to home/i })).toHaveLength(2)
    expect(screen.getByLabelText('Back to home')).toHaveAttribute('href', '/')
  })
})
