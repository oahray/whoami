import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('renders label, hint, and value', () => {
    const { container } = render(
      <StatCard
        icon="group"
        label="Players connected"
        hint="Live count"
        value={12}
        iconTone="success"
      />
    )

    expect(screen.getByText('Players connected')).toBeInTheDocument()
    expect(screen.getByText('Live count')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('p-3')
    expect(container.firstChild).toHaveClass('md:flex-row')
  })

  it('keeps stacked layout when requested', () => {
    const { container } = render(
      <StatCard icon="category" label="Entities by type" value="10 characters" layout="stacked" />
    )

    expect(container.firstChild).toHaveClass('flex-col')
    expect(container.firstChild).not.toHaveClass('md:flex-row')
  })

  it('keeps value on the same row when requested', () => {
    const { container } = render(
      <StatCard icon="publish" label="Ready to publish" value={0} layout="row" />
    )

    expect(container.firstChild).toHaveClass('items-center')
    expect(container.firstChild).not.toHaveClass('flex-col')
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
