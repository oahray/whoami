import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DifficultyMultiSelect } from './DifficultyMultiSelect'

describe('DifficultyMultiSelect', () => {
  it('deselects one tier from "all" and keeps the rest', () => {
    const onChange = vi.fn()
    render(<DifficultyMultiSelect value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }))

    expect(onChange).toHaveBeenCalledWith(['medium', 'hard', 'nightmare'])
  })

  it('treats re-selecting every tier as "all"', () => {
    const onChange = vi.fn()
    render(<DifficultyMultiSelect value={['medium', 'hard', 'nightmare']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('keeps tiers in canonical order when adding one', () => {
    const onChange = vi.fn()
    render(<DifficultyMultiSelect value={['hard']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }))

    expect(onChange).toHaveBeenCalledWith(['easy', 'hard'])
  })
})
