import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithPreferences } from '../test/renderWithPreferences'
import PlaySetup from './PlaySetup'

const mockNavigate = vi.fn()

vi.mock('../hooks/useMaintenanceStatus', () => ({
  useMaintenanceStatus: () => ({
    status: { phase: 'none', endsAt: null, startsAt: null },
    loading: false
  })
}))

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
    localStorage.clear()
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
            },
            selectedCount: 2
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

    renderWithPreferences(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start cards/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^medium$/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /^hard$/i })).toBeDisabled()
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

  it('keeps card type selectable when the current type has no playable content', async () => {
    let eligibilityCalls = 0

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
        eligibilityCalls += 1
        const entityType = new URL(url, 'http://localhost').searchParams.get('entityType')
        const modes =
          entityType === 'place'
            ? { any: 3, easy: 3, medium: 3, hard: 3, nightmare: 3 }
            : { any: 0, easy: 0, medium: 0, hard: 0, nightmare: 0 }
        return {
          ok: true,
          json: async () => ({ modes })
        } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    renderWithPreferences(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    const entityTypeSelect = await screen.findByLabelText(/card type/i)
    await waitFor(() => {
      expect(screen.getByText(/not enough clues for this card type/i)).toBeInTheDocument()
    })
    expect(entityTypeSelect).not.toBeDisabled()

    fireEvent.change(entityTypeSelect, { target: { value: 'place' } })

    await waitFor(() => {
      expect(eligibilityCalls).toBeGreaterThanOrEqual(2)
      expect(screen.getByRole('button', { name: /start cards/i })).not.toBeDisabled()
    })
  })

  it('shows offline message when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response)

    renderWithPreferences(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/internet required to load cards/i)).toBeInTheDocument()
    })
  })

  it('restores the current setup selection after refresh', async () => {
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
            },
            {
              id: 'ds-2',
              name: 'Org History',
              source: null,
              description: null,
              is_default: false
            }
          ]
        } as Response
      }
      if (url.includes('/cards/eligibility')) {
        return {
          ok: true,
          json: async () => ({
            modes: {
              any: 5,
              easy: 5,
              medium: 5,
              hard: 5,
              nightmare: 5
            },
            selectedCount: 5
          })
        } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const firstRender = renderWithPreferences(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    const datasetSelect = await screen.findByLabelText(/content/i)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^hard$/i })).toHaveAttribute('aria-pressed', 'true')
    })

    fireEvent.change(datasetSelect, { target: { value: 'ds-2' } })
    fireEvent.change(screen.getByLabelText(/card type/i), { target: { value: 'place' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'true')
    })

    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'false')
    })
    await waitFor(() => {
      expect(localStorage.getItem('whoami-in-person-setup')).toContain('"difficulty":["medium","hard","nightmare"]')
    })

    firstRender.unmount()

    renderWithPreferences(
      <MemoryRouter>
        <PlaySetup />
      </MemoryRouter>
    )

    expect(await screen.findByLabelText(/content/i)).toHaveValue('ds-2')
    expect(screen.getByLabelText(/card type/i)).toHaveValue('place')
    expect(screen.getByRole('button', { name: /^easy$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^medium$/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
