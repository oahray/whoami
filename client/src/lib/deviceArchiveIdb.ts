import { mergeDeviceArchives, type StoredArchiveRecord } from './deviceArchiveMerge'
import type { SignedHistoryArchive } from './historyArchivePayload'

const DB_NAME = 'whoami-local-history'
const STORE_NAME = 'archives'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'))
  })
}

export async function readStoredArchives(): Promise<StoredArchiveRecord[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const rows = await requestToPromise(store.getAll() as IDBRequest<StoredArchiveRecord[]>)
    db.close()
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export async function writeStoredArchives(rows: StoredArchiveRecord[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await requestToPromise(store.clear())
  for (const row of rows) {
    await requestToPromise(store.put(row))
  }
  db.close()
}

export async function appendStoredArchive(incoming: SignedHistoryArchive): Promise<void> {
  const existing = await readStoredArchives()
  const next = mergeDeviceArchives(existing, incoming)
  await writeStoredArchives(next)
}
