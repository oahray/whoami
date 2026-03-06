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

    fireEvent.change(screen.getByPlaceholderText('e.g. Apostle Paul'), {
      target: { value: 'Paul' }
    })
    fireEvent.change(screen.getByPlaceholderText('6-character code'), {
      target: { value: 'ab12cd' }
    })
    fireEvent.click(screen.getByRole('button', { name: /join room/i }))

    expect(localStorage.getItem('whoami_nickname')).toBe('Paul')
    expect(emit).toHaveBeenCalledWith('JOIN_ROOM', {
      roomCode: 'AB12CD',
      nickname: 'Paul'
    })
    expect(setError).toHaveBeenCalledWith(null)
  })
})
