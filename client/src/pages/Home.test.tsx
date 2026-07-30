import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home'

const mockUseGame = vi.fn()
const mockUseSocket = vi.fn()

vi.mock('../hooks/useGame', () => ({
  useGame: () => mockUseGame()
}))

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockUseSocket()
}))

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockUseGame.mockReturnValue({
      roomCode: null,
      error: null,
      setError: vi.fn(),
      setRoomCode: vi.fn()
    })

    mockUseSocket.mockReturnValue({
      socket: {
        on: vi.fn(),
        off: vi.fn()
      },
      emit: vi.fn(),
      connected: true
    })
  })

  it('prefills room code from URL once and lets the user clear it', () => {
    render(
      <MemoryRouter initialEntries={['/?room=abc123']}>
        <Home />
      </MemoryRouter>
    )

    const roomCodeInput = screen.getByPlaceholderText('6-character code') as HTMLInputElement

    expect(roomCodeInput.value).toBe('ABC123')

    fireEvent.change(roomCodeInput, { target: { value: '' } })

    expect(roomCodeInput.value).toBe('')
  })

  it('stores nickname and emits JOIN_ROOM with uppercase code', () => {
    const emit = vi.fn()
    const setError = vi.fn()

    mockUseGame.mockReturnValue({
      roomCode: null,
      error: null,
      setError,
      setRoomCode: vi.fn()
    })

    mockUseSocket.mockReturnValue({
      socket: {
        on: vi.fn(),
        off: vi.fn()
      },
      emit,
      connected: true
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('e.g. Samuel'), {
      target: { value: 'Paul' }
    })
    fireEvent.change(screen.getByPlaceholderText('6-character code'), {
      target: { value: 'ab12cd' }
    })
    fireEvent.click(screen.getByRole('button', { name: /join room/i }))

    expect(localStorage.getItem('whoami_nickname')).toBe('Paul')
    expect(emit).toHaveBeenCalledWith('JOIN_ROOM', {
      roomCode: 'AB12CD',
      nickname: 'Paul',
      avatarId: expect.stringMatching(/^avatar-\d{2}$/)
    })
    expect(setError).toHaveBeenCalledWith(null)
  })

  it('does not clear an existing room session just by rendering Home', () => {
    const emit = vi.fn()

    mockUseGame.mockReturnValue({
      roomCode: 'ABC123',
      error: null,
      setError: vi.fn(),
      setRoomCode: vi.fn()
    })

    mockUseSocket.mockReturnValue({
      socket: {
        on: vi.fn(),
        off: vi.fn()
      },
      emit,
      connected: true
    })

    localStorage.setItem('whoami_room', JSON.stringify({
      roomCode: 'ABC123',
      nickname: 'Paul'
    }))

    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    )

    expect(emit).not.toHaveBeenCalledWith('LEAVE_ROOM', {})
    expect(localStorage.getItem('whoami_room')).not.toBeNull()
  })

  it('shows the brand logo in the hero', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByRole('img', { name: /who am i\?/i })).toHaveAttribute(
      'src',
      '/brand-logo.svg'
    )
  })

  it('links to solo mode, pass & play and about', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /^solo$/i })).toHaveAttribute('href', '/solo')
    expect(screen.getByRole('link', { name: /pass & play/i })).toHaveAttribute('href', '/play')
    expect(screen.getByRole('link', { name: /^about$/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /^privacy$/i })).toHaveAttribute('href', '/privacy')
  })

  it('surfaces a kick message stashed in sessionStorage and clears it after showing', () => {
    const setError = vi.fn()

    mockUseGame.mockReturnValue({
      roomCode: null,
      error: null,
      setError,
      setRoomCode: vi.fn()
    })

    window.sessionStorage.setItem(
      'whoami_kick_message',
      'You have been removed from the room by the host.'
    )

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(setError).toHaveBeenCalledWith(
      'You have been removed from the room by the host.'
    )
    expect(window.sessionStorage.getItem('whoami_kick_message')).toBeNull()
  })
})
