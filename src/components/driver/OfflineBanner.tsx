'use client'

import { useEffect, useState } from 'react'
import { count as walCount, drain } from '@/lib/driver/offline-wal'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [queued, setQueued]   = useState(0)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    if (typeof navigator !== 'undefined') setOffline(!navigator.onLine)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    walCount().then(setQueued).catch(() => {})

    const pulse = window.setInterval(async () => {
      try {
        setQueued(await walCount())
        if (navigator.onLine) {
          const r = await drain()
          if (r.sent > 0) setQueued(await walCount())
        }
      } catch {}
    }, 5000)

    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
      window.clearInterval(pulse)
    }
  }, [])

  if (!offline && queued === 0) return null
  return (
    <div className="em-offline-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 3.7-2.5M19 12.9a10 10 0 0 0-8.5-2.7M2 8.8a15 15 0 0 1 4.2-2.6M21.9 8.8a15 15 0 0 0-7-4"/>
      </svg>
      <strong>{offline ? 'Offline' : 'Syncing'}</strong>
      {queued} ticket{queued === 1 ? '' : 's'} queued{offline ? ', will sync' : '…'}
      <span>{queued > 0 ? `${queued} pending` : ''}</span>
    </div>
  )
}
