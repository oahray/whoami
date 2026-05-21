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
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('loads datasets and navigates to cards on start', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
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
    } as Response)

    render(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start cards/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /start cards/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/play/cards?datasetId=ds-1&difficulty=any')
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
