import { render, screen } from '@testing-library/react'
import LoadingState from './LoadingState'

describe('LoadingState', () => {
  it('shows label with status role and spinner', () => {
    render(<LoadingState label="Loading game" layout="inline" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading game')
    expect(screen.getByText('progress_activity')).toBeInTheDocument()
  })

  it('renders compact layout for inline hints', () => {
    render(<LoadingState label="Refreshing" layout="compact" />)

    expect(screen.getByRole('status')).toHaveClass('inline-flex')
    expect(screen.getByText('Refreshing')).toBeInTheDocument()
  })
})
