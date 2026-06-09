import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminActiveDatasetBar from './AdminActiveDatasetBar'

const mockUseAdminDataset = vi.fn()

vi.mock('../context/AdminDatasetContext', () => ({
  useAdminDataset: () => mockUseAdminDataset(),
}))

const dataset = {
  id: 'ds-1',
  name: 'Bible Characters',
  source: 'NWT',
  is_enabled: true,
  is_default: true,
  is_official: true,
}

function renderBar() {
  return render(
    <MemoryRouter>
      <AdminActiveDatasetBar />
    </MemoryRouter>
  )
}

describe('AdminActiveDatasetBar', () => {
  beforeEach(() => {
    localStorage.clear()
    mockUseAdminDataset.mockReturnValue({
      enabledDatasets: [dataset],
      selectedDatasetId: 'ds-1',
      selectedDataset: dataset,
      setSelectedDatasetId: vi.fn(),
      loading: false,
      error: null,
    })
  })

  it('collapses and expands while keeping the dataset name visible', () => {
    renderBar()

    expect(screen.getByText('Active dataset')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Collapse dataset banner'))

    expect(screen.queryByText('Active dataset')).not.toBeInTheDocument()
    expect(screen.getByText('Bible Characters')).toBeInTheDocument()
    expect(screen.getByText(/Active:/)).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Expand dataset details'))
    expect(screen.getByText('Active dataset')).toBeInTheDocument()
  })

  it('persists collapsed preference', () => {
    renderBar()
    fireEvent.click(screen.getByTitle('Collapse dataset banner'))
    expect(localStorage.getItem('whoami_admin_dataset_bar_collapsed')).toBe('1')

    cleanup()
    renderBar()
    expect(screen.queryByText('Active dataset')).not.toBeInTheDocument()
    expect(screen.getByTitle('Expand dataset details')).toBeInTheDocument()
  })
})
