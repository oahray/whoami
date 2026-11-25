import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProgressBackupSection from './ProgressBackupSection'
import { createBackupFile, type ProgressSnapshot } from '../lib/progressBackup'
import type { EntityMastery } from '../lib/soloMastery'

vi.mock('../lib/deviceArchiveIdb', () => ({
  readStoredArchives: vi.fn(async () => []),
  writeStoredArchives: vi.fn(async () => {})
}))

function mastery(entityId: string): EntityMastery {
  return {
    datasetId: 'bible',
    entityId,
    entityName: entityId,
    encounters: 1,
    correctCount: 1,
    firstClueCorrectCount: 0,
    missCount: 0,
    lastCorrect: true,
    lastEncounteredAt: '2026-01-10T10:00:00.000Z',
    state: 'learning'
  }
}

function backupSnapshot(): ProgressSnapshot {
  return {
    daily: { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, results: {}, summaries: {} },
    records: [],
    mastery: { 'bible:moses': mastery('moses') },
    trends: {},
    history: []
  }
}

async function backupFile(): Promise<File> {
  const { blob } = await createBackupFile(backupSnapshot())
  return new File([await blob.text()], 'whoami-progress.wai')
}

async function chooseFile(file: File) {
  const input = screen.getByLabelText('Backup file')
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
}

describe('ProgressBackupSection', () => {
  beforeEach(() => {
    localStorage.clear()
    URL.createObjectURL = vi.fn(() => 'blob:backup')
    URL.revokeObjectURL = vi.fn()
  })

  it('has nothing to back up on a fresh device', async () => {
    render(<ProgressBackupSection />)
    fireEvent.click(screen.getByRole('button', { name: /back up/i }))
    expect(await screen.findByText(/nothing to back up yet/i)).toBeInTheDocument()
  })

  it('downloads a backup and remembers when', async () => {
    localStorage.setItem('whoami-solo-mastery-v1', JSON.stringify({ version: 1, entities: { 'bible:moses': mastery('moses') }, appliedEvents: {} }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ProgressBackupSection />)
    expect(screen.getByText(/not backed up on this device yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back up/i }))
    expect(await screen.findByText(/saved whoami-progress-.*\.wai/i)).toBeInTheDocument()
    expect(click).toHaveBeenCalled()
    expect(screen.getByText(/last backed up/i)).toBeInTheDocument()
    click.mockRestore()
  })

  it('explains when a file is not a backup', async () => {
    render(<ProgressBackupSection />)
    await chooseFile(new File(['hello'], 'notes.txt'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't a whoami backup/i)
  })

  it('restores straight away on a device with no progress', async () => {
    const onRestored = vi.fn()
    render(<ProgressBackupSection onRestored={onRestored} />)
    await chooseFile(await backupFile())
    const dialog = await screen.findByRole('dialog', { name: /restore progress/i })
    expect(dialog).toHaveTextContent(/1 character met/i)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /^restore$/i }))
    await waitFor(() => expect(onRestored).toHaveBeenCalled())
    expect(JSON.parse(localStorage.getItem('whoami-solo-mastery-v1') ?? '{}').entities).toHaveProperty('bible:moses')
  })

  it('asks before replacing progress already on the device', async () => {
    localStorage.setItem('whoami-solo-mastery-v1', JSON.stringify({ version: 1, entities: { 'bible:ruth': mastery('ruth') }, appliedEvents: {} }))
    const onRestored = vi.fn()
    render(<ProgressBackupSection onRestored={onRestored} />)
    await chooseFile(await backupFile())
    const dialog = await screen.findByRole('dialog', { name: /restore progress/i })
    expect(screen.getByRole('radio', { name: /combine/i })).toBeChecked()
    expect(dialog).toHaveTextContent(/2 characters met/i)

    fireEvent.click(screen.getByRole('radio', { name: /replace/i }))
    expect(dialog).toHaveTextContent(/1 character met/i)
    fireEvent.click(screen.getByRole('button', { name: /^replace$/i }))
    expect(onRestored).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/can't be undone/i)

    fireEvent.click(screen.getByRole('button', { name: /yes, replace/i }))
    await waitFor(() => expect(onRestored).toHaveBeenCalled())
    const entities = JSON.parse(localStorage.getItem('whoami-solo-mastery-v1') ?? '{}').entities
    expect(Object.keys(entities)).toEqual(['bible:moses'])
  })
})
