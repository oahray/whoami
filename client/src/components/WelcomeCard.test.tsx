import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WelcomeCard from './WelcomeCard'
import { WELCOME_SEEN_KEY } from '../lib/firstRun'

vi.mock('../lib/deviceArchiveIdb', () => ({
  readStoredArchives: vi.fn().mockResolvedValue([]),
}))

function renderCard() {
  return render(
    <MemoryRouter>
      <WelcomeCard />
    </MemoryRouter>,
  )
}

describe('WelcomeCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows to a new player', async () => {
    renderCard()
    expect(await screen.findByRole('heading', { name: /can you tell who/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /try a solo game/i })).toHaveAttribute('href', '/solo')
    expect(screen.getByRole('link', { name: /how to play/i })).toHaveAttribute('href', '/about')
  })

  it('comes back after a refresh until it is dismissed', async () => {
    const first = renderCard()
    await screen.findByRole('heading', { name: /can you tell who/i })
    first.unmount()

    renderCard()
    expect(await screen.findByRole('heading', { name: /can you tell who/i })).toBeInTheDocument()
  })

  it('stays gone once dismissed', async () => {
    const first = renderCard()
    fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('heading', { name: /can you tell who/i })).not.toBeInTheDocument()
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1')
    first.unmount()

    renderCard()
    await Promise.resolve()
    expect(screen.queryByRole('heading', { name: /can you tell who/i })).not.toBeInTheDocument()
  })

  it('stays hidden for someone who has played', async () => {
    localStorage.setItem('whoami-solo-records', '[]')
    renderCard()
    await Promise.resolve()
    expect(screen.queryByRole('heading', { name: /can you tell who/i })).not.toBeInTheDocument()
  })
})
