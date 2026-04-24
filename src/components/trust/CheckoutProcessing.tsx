'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Role = 'driver' | 'gc'

const POLL_MS = 3000
const TIMEOUT_MS = 5 * 60 * 1000

function dashboardRoot(role: Role): string {
  return role === 'gc' ? '/dashboard/gc/contractors' : '/dashboard/driver/trust'
}

export default function CheckoutProcessing({ role }: { role: Role }) {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [errored, setErrored] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const startedAt = useRef<number>(Date.now())

  useEffect(() => {
    if (!sessionId) {
      router.replace('/dashboard')
      return
    }
    let cancelled = false

    async function tick() {
      if (cancelled) return
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setTimedOut(true)
        return
      }
      try {
        const res = await fetch(
          `/api/trust/checkout/success?session_id=${encodeURIComponent(sessionId!)}&format=json`,
          { cache: 'no-store' },
        )
        if (res.status === 202) {
          setTimeout(tick, POLL_MS)
          return
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data?.status === 'ready' && data?.job_id) {
            router.replace(`${dashboardRoot(role)}?job_id=${encodeURIComponent(data.job_id)}&auto=1`)
            return
          }
          setTimeout(tick, POLL_MS)
          return
        }
        setErrored(true)
      } catch {
        setErrored(true)
      }
    }

    tick()
    return () => { cancelled = true }
  }, [sessionId, role, router])

  if (!sessionId) return null

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '70vh', padding: 24, textAlign: 'center',
      }}
    >
      {!errored && !timedOut && (
        <>
          <div
            aria-label="Loading"
            style={{
              width: 48, height: 48, border: '4px solid #d1fae5',
              borderTopColor: '#059669', borderRadius: '50%',
              animation: 'cp-spin 0.8s linear infinite', marginBottom: 20,
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 600, color: '#065f46' }}>
            Finalizing your purchase…
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            This usually takes a few seconds.
          </div>
        </>
      )}
      {timedOut && (
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>
            Still processing
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
            Contact <a href="mailto:support@earthmove.io" style={{ color: '#059669', textDecoration: 'underline' }}>support@earthmove.io</a>{' '}
            with reference <code style={{ fontFamily: 'monospace' }}>{sessionId}</code>.
          </div>
        </div>
      )}
      {errored && !timedOut && (
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#991b1b' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
            Contact <a href="mailto:support@earthmove.io" style={{ color: '#059669', textDecoration: 'underline' }}>support@earthmove.io</a>{' '}
            with reference <code style={{ fontFamily: 'monospace' }}>{sessionId}</code>.
          </div>
        </div>
      )}
      <div style={{ marginTop: 40, fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>
        {sessionId}
      </div>
      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
