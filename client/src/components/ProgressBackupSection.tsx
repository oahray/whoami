import { useRef, useState } from 'react'
import {
  BackupError,
  createBackupFile,
  hasProgress,
  lastBackedUpAt,
  markBackedUp,
  previewRestore,
  readBackupFile,
  readLocalSnapshot,
  restoredSnapshot,
  writeSnapshot,
  type BackupContents,
  type ProgressSnapshot,
  type RestoreMode
} from '../lib/progressBackup'

const ERROR_COPY: Record<BackupError['code'], string> = {
  'not-backup': "That file isn't a WhoAmI backup.",
  'newer-version': 'This backup is from a newer version of WhoAmI. Refresh the app and try again.',
  damaged: "This backup is damaged or was changed, so it can't be restored."
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value)
  )
}

function formatDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateKey}T00:00:00Z`)
  )
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some mobile browsers start the download after click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

type PendingRestore = {
  contents: BackupContents
  local: ProgressSnapshot
  localHasProgress: boolean
}

type ProgressBackupSectionProps = {
  /** Every Solo screen reads its stores when it mounts, so a reload shows the restored progress everywhere. */
  onRestored?: () => void
}

function ProgressBackupSection({ onRestored = () => window.location.reload() }: ProgressBackupSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [lastBackup, setLastBackup] = useState(lastBackedUpAt)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [mode, setMode] = useState<RestoreMode>('combine')
  const [confirmReplace, setConfirmReplace] = useState(false)

  const backUp = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const snapshot = await readLocalSnapshot()
      if (!hasProgress(snapshot)) {
        setStatus({ tone: 'info', text: 'Nothing to back up yet. Play a game first.' })
        return
      }
      const { blob, fileName } = await createBackupFile(snapshot)
      downloadBlob(blob, fileName)
      markBackedUp()
      setLastBackup(lastBackedUpAt())
      setStatus({
        tone: 'info',
        text: `Saved ${fileName}. Keep it somewhere you can reach from your other device.`
      })
    } catch {
      setStatus({ tone: 'error', text: "Couldn't make the backup on this browser." })
    } finally {
      setBusy(false)
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setStatus(null)
    try {
      const contents = await readBackupFile(file)
      const local = await readLocalSnapshot()
      const localHasProgress = hasProgress(local)
      setMode('combine')
      setConfirmReplace(false)
      setPending({ contents, local, localHasProgress })
    } catch (error) {
      const text =
        error instanceof BackupError ? ERROR_COPY[error.code] : "Couldn't read that file."
      setStatus({ tone: 'error', text })
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const restore = async () => {
    if (!pending) return
    if (mode === 'replace' && pending.localHasProgress && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    setBusy(true)
    try {
      await writeSnapshot(restoredSnapshot(pending.local, pending.contents.snapshot, mode))
      onRestored()
    } catch {
      setPending(null)
      setStatus({
        tone: 'error',
        text: 'There was no room to save the backup on this device, so nothing was changed.'
      })
      setBusy(false)
    }
  }

  const result = pending
    ? restoredSnapshot(pending.local, pending.contents.snapshot, pending.localHasProgress ? mode : 'replace')
    : null
  const preview = pending && result ? previewRestore(pending.contents, result) : null

  return (
    <section aria-labelledby="progress-backup-title" className="space-y-2 border-t border-edge pt-4">
      <h3 id="progress-backup-title" className="text-foreground text-sm font-medium">
        Your progress
      </h3>
      <p className="text-xs text-foreground-muted">
        Save your Solo progress and online games to a file, then restore it on another device.
        {' '}
        {lastBackup ? `Last backed up ${formatDay(lastBackup)}.` : 'Not backed up on this device yet.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={backUp}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-surface-muted px-2 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
          Back up
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-surface-muted px-2 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">upload</span>
          Restore
        </button>
      </div>
      {/* No accept filter: iOS greys out file types it doesn't know. The content is checked instead. */}
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Backup file"
        onChange={(event) => void pickFile(event.target.files?.[0])}
      />
      {status && (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`text-xs ${status.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-foreground-muted'}`}
        >
          {status.text}
        </p>
      )}

      {pending && preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
            className="w-full max-w-sm rounded-xl border border-edge bg-surface p-5 text-left shadow-2xl"
          >
            <h2 id="restore-title" className="text-foreground text-lg font-bold">
              Restore progress
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Backup from {formatDay(pending.contents.createdAt)}.
            </p>

            {pending.localHasProgress && (
              <fieldset className="mt-4 space-y-2">
                <legend className="sr-only">How to restore</legend>
                {(
                  [
                    ['combine', 'Combine with this device', 'Keeps everything from both. Nothing is counted twice.'],
                    ['replace', "Replace this device's progress", 'Anything only on this device is removed.']
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 ${
                      mode === value ? 'border-primary bg-primary/10' : 'border-edge bg-surface-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restore-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value)
                        setConfirmReplace(false)
                      }}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{label}</span>
                      <span className="block text-xs text-foreground-muted">{hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            <p className="mt-4 text-sm text-foreground">
              After restoring: Daily streak <strong>{preview.streakAfter}</strong>
              {[
                preview.dailyDays > 0 && plural(preview.dailyDays, 'Daily', 'Dailies'),
                preview.cardsMet > 0 && `${plural(preview.cardsMet, 'character')} met`,
                preview.runs > 0 && plural(preview.runs, 'Classic or Endurance run', 'Classic and Endurance runs'),
                preview.games > 0 && plural(preview.games, 'online game')
              ]
                .filter(Boolean)
                .map((part) => `, ${part}`)
                .join('')}
              .
            </p>

            {preview.streakAfter < preview.streakInBackup && preview.lastDailyInBackup && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Your last Daily in this backup is {formatDateKey(preview.lastDailyInBackup)}, so your streak
                would be {preview.streakAfter}. If you've played since on your other device, back up again there
                first.
              </p>
            )}

            {confirmReplace && (
              <p role="alert" className="mt-3 text-xs font-semibold text-red-600 dark:text-red-400">
                This removes progress that's only on this device. It can't be undone.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={restore}
                disabled={busy}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${
                  mode === 'replace' && pending.localHasProgress ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {!pending.localHasProgress
                  ? 'Restore'
                  : mode === 'combine'
                    ? 'Combine'
                    : confirmReplace
                      ? 'Yes, replace'
                      : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ProgressBackupSection
