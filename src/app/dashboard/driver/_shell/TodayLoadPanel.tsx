'use client'

import { useState } from 'react'
import { SwipeToConfirm } from '@/components/driver/SwipeToConfirm'
import { SWIPE_LABEL, nextPhase, type Phase } from '@/lib/driver/phase-machine'
import { postWithWal } from '@/lib/driver/offline-wal'
import { readLocal } from '@/lib/driver/prefs'
import type { EarningsDetail } from '@/components/driver/EarningsMoment'

type Props = {
  dispatchId: string
  initialPhase: Phase
  loadLabel?: string
  nextLoadLabel?: string
  tonsActual?: number
}

export function TodayLoadPanel({ dispatchId, initialPhase, loadLabel, nextLoadLabel, tonsActual }: Props) {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  // TODO: subscribe to body.class changes (MutationObserver) so SwipeToConfirm gets a fresh longPressMs when glove mode toggles mid-load. Today's behavior locks the value at mount — fine because glove is typically set once per shift.
  const glove = typeof document !== 'undefined' && document.body.classList.contains('glove')

  if (phase === 'ticket_submitted') {
    return (
      <div className="em-swipe" aria-disabled>
        <div className="em-swipe__fill" />
        <div className="em-swipe__track"><span>Load complete</span></div>
      </div>
    )
  }

  return (
    <SwipeToConfirm
      label={SWIPE_LABEL[phase]}
      gloveMode={glove}
      longPressMs={glove ? 400 : 0}
      onConfirm={async () => {
        const target = nextPhase(phase)
        if (!target) return
        const coords = await readCoords()
        const res = await postWithWal('/api/driver/advance-phase', {
          dispatch_id: dispatchId,
          next_phase:  target,
          lat: coords?.lat ?? undefined,
          lng: coords?.lng ?? undefined,
        }, 'advance_phase')

        // Optimistic: advance the UI regardless of response — the WAL will sync.
        setPhase(target)

        if (target === 'ticket_submitted') {
          const prev = readLocal().earnings_moment_seen_count ?? 0
          const body = res ? await res.clone().json().catch(() => null) : null
          const detail: EarningsDetail = {
            amount:      body?.earnings_dollars ?? 0,
            loadLabel:   loadLabel ?? 'Load delivered',
            tonsActual,
            haulMinutes: undefined,
            onTimePct:   undefined,
            nextLoad:    nextLoadLabel,
          }
          window.dispatchEvent(new CustomEvent('em:earnings', { detail }))
          // bump seen count in localStorage; db sync happens via prefs.saveToDb elsewhere
          try {
            const cur = JSON.parse(localStorage.getItem('em-driver-ui-prefs') || '{}')
            cur.earnings_moment_seen_count = prev + 1
            localStorage.setItem('em-driver-ui-prefs', JSON.stringify(cur))
          } catch {}
        }
      }}
    />
  )
}

function readCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 30_000 },
    )
  })
}
