import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import NotFound from './NotFound'

describe('NotFound', () => {
  it('explains the missing page and links home', () => {
    renderWithPreferences(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /doesn.t exist/i })).toBeInTheDocument()
    expect(screen.getByText('Error 404')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /back to home/i })).toHaveLength(2)
    expect(screen.getByLabelText('Back to home')).toHaveAttribute('href', '/')
  })
})
