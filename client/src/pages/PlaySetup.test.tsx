import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaySetup from './PlaySetup'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('PlaySetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('loads datasets, disables empty difficulties, and starts a deck', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/datasets')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 'ds-1',
              name: 'Bible',
              source: null,
              description: null,
              is_default: true
            }
          ]
        } as Response
      }
      if (url.includes('/cards/eligibility')) {
        return {
          ok: true,
          json: async () => ({
            modes: {
              any: 2,
              easy: 2,
              medium: 0,
              hard: 0,
              nightmare: 0
            }
          })
        } as Response
      }
      if (url.includes('/cards/deck')) {
        return {
          ok: true,
          json: async () => ({ entityIds: ['ent-1', 'ent-2'] })
        } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start cards/i })).toBeInTheDocument()
    })

    const difficultySelect = screen.getByLabelText(/difficulty/i) as HTMLSelectElement
    await waitFor(() => {
      expect(difficultySelect.options[2]).toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cards/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/play/cards?datasetId=ds-1&difficulty=any&entityType=character'
      )
    })

    const deck = sessionStorage.getItem('whoami-in-person-deck')
    expect(deck).toContain('ent-1')
  })

  it('shows offline message when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response)

    render(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/internet required to load cards/i)).toBeInTheDocument()
    })
  })
})
