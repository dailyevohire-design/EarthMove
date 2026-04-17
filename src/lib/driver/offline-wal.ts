'use client'

// IndexedDB-backed write-ahead log for driver actions taken offline.
// Queues advance-phase POSTs, GPS beacons, and ticket/photo submits;
// drains opportunistically when navigator.onLine && fetch succeeds.

export type WalEntry = {
  id?: number
  kind: 'advance_phase' | 'location' | 'ticket_submit' | 'photo'
  endpoint: string
  body: unknown
  created_at: number
  tries: number
}

const DB_NAME = 'em-driver-wal'
const STORE = 'queue'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(entry: Omit<WalEntry, 'id' | 'created_at' | 'tries'>): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add({ ...entry, created_at: Date.now(), tries: 0 })
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function count(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function drain(): Promise<{ sent: number; failed: number }> {
  if (!navigator.onLine) return { sent: 0, failed: 0 }
  const db = await openDb()

  const entries = await new Promise<WalEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as WalEntry[])
    req.onerror = () => reject(req.error)
  })

  let sent = 0, failed = 0
  for (const e of entries) {
    try {
      const res = await fetch(e.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.body),
      })
      if (res.ok) {
        await deleteEntry(e.id!)
        sent++
      } else if (res.status >= 400 && res.status < 500) {
        // client error — drop, don't retry forever
        await deleteEntry(e.id!)
        failed++
      } else {
        await bumpTries(e.id!)
        failed++
      }
    } catch {
      await bumpTries(e.id!)
      failed++
    }
  }
  return { sent, failed }
}

async function deleteEntry(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function bumpTries(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const e = getReq.result as WalEntry | undefined
      if (!e) return resolve()
      e.tries = (e.tries || 0) + 1
      const putReq = store.put(e)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// Post with offline fallback: try fetch; on network failure, enqueue and return null.
export async function postWithWal(endpoint: string, body: unknown, kind: WalEntry['kind']): Promise<Response | null> {
  if (navigator.onLine) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return res
      if (res.status >= 500) {
        await enqueue({ kind, endpoint, body })
        return null
      }
      return res
    } catch {
      await enqueue({ kind, endpoint, body })
      return null
    }
  }
  await enqueue({ kind, endpoint, body })
  return null
}
