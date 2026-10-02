import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAloneInRoomPrompt } from './useAloneInRoomPrompt'

describe('useAloneInRoomPrompt', () => {
  it('does not open when the room starts with one player', () => {
    const { result } = renderHook(() =>
      useAloneInRoomPrompt([{ id: 'me' }], 'me')
    )
    expect(result.current.alonePromptOpen).toBe(false)
  })

  it('opens when the room drops from multiple players to only the local player', () => {
    const { result, rerender } = renderHook(
      ({ players, playerId }) => useAloneInRoomPrompt(players, playerId),
      {
        initialProps: {
          players: [
            { id: 'me' },
            { id: 'them' }
          ],
          playerId: 'me'
        }
      }
    )

    expect(result.current.alonePromptOpen).toBe(false)

    act(() => {
      rerender({ players: [{ id: 'me' }], playerId: 'me' })
    })

    expect(result.current.alonePromptOpen).toBe(true)
  })

  it('closes again when another player joins', () => {
    const { result, rerender } = renderHook(
      ({ players, playerId }) => useAloneInRoomPrompt(players, playerId),
      {
        initialProps: {
          players: [
            { id: 'me' },
            { id: 'them' }
          ],
          playerId: 'me'
        }
      }
    )

    act(() => {
      rerender({ players: [{ id: 'me' }], playerId: 'me' })
    })
    expect(result.current.alonePromptOpen).toBe(true)

    act(() => {
      rerender({
        players: [
          { id: 'me' },
          { id: 'new' }
        ],
        playerId: 'me'
      })
    })
    expect(result.current.alonePromptOpen).toBe(false)
  })

  it('can be dismissed while remaining alone', () => {
    const { result, rerender } = renderHook(
      ({ players, playerId }) => useAloneInRoomPrompt(players, playerId),
      {
        initialProps: {
          players: [
            { id: 'me' },
            { id: 'them' }
          ],
          playerId: 'me'
        }
      }
    )

    act(() => {
      rerender({ players: [{ id: 'me' }], playerId: 'me' })
    })
    act(() => {
      result.current.dismissAlonePrompt()
    })
    expect(result.current.alonePromptOpen).toBe(false)
  })
})
