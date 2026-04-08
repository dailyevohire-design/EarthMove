'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  /** Currently selected market name, if any. Used as the resting state. */
  currentMarketName: string | null
  currentMarketState: string | null
}

/**
 * Compact ZIP picker for the hero. Replaces the static "Delivering to X | Change city"
 * pill. Three states:
 *   - resting: shows current market with "Change" toggle
 *   - editing: inline ZIP input
 *   - not-found: ZIP outside service area, with waitlist nudge
 */
type ErrorState =
  | { kind: 'out_of_area'; zip: string }
  | { kind: 'db_error'; message: string }
  | null

export function HeroZipPicker({ currentMarketName, currentMarketState }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'resting' | 'editing' | 'not-found' | 'error'>(
    currentMarketName ? 'resting' : 'editing'
  )
  const [zip, setZip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorState>(null)
  const [, startTransition] = useTransition()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (zip.length !== 5) return

    setLoading(true)
    setError(null)

    let result: any = null
    try {
      const res = await fetch('/api/resolve-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip }),
      })
      result = await res.json()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[hero-zip-picker] resolve fetch failed:', err)
      setError({ kind: 'db_error', message: 'Network error — please try again.' })
      setMode('error')
      setLoading(false)
      return
    }

    if (!result?.ok) {
      const reason = result?.reason as string | undefined
      if (reason === 'out_of_area' || reason === 'invalid_zip') {
        setMode('not-found')
      } else {
        // eslint-disable-next-line no-console
        console.error('[hero-zip-picker] resolve returned error:', result)
        setError({
          kind: 'db_error',
          message: result?.detail ?? 'We could not load materials for that ZIP. Please try again.',
        })
        setMode('error')
      }
      setLoading(false)
      return
    }

    const marketId: string = result.market.id
    document.cookie = `market_id=${marketId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    startTransition(() => {
      router.refresh()
      setLoading(false)
      setMode('resting')
      setZip('')
      setError(null)
    })
  }

  if (mode === 'resting' && currentMarketName) {
    return (
      <div
        className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl mb-8 shadow-2xl shadow-emerald-500/30"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.10))',
          border: '2px solid rgba(16,185,129,0.6)',
        }}
      >
        <MapPin size={22} className="text-emerald-300" />
        <span className="text-white text-lg md:text-xl font-bold">
          Delivering to {currentMarketName}, {currentMarketState}
        </span>
        <span className="text-white/40 mx-1">|</span>
        <button
          type="button"
          onClick={() => setMode('editing')}
          className="text-emerald-300 text-base font-extrabold hover:text-emerald-200 transition-colors"
        >
          Change ZIP →
        </button>
      </div>
    )
  }

  if (mode === 'not-found') {
    return (
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        <AlertCircle size={14} className="text-amber-400" />
        <span className="text-white/90 text-sm font-medium">
          Not in <span className="font-bold">{zip}</span> yet
        </span>
        <span className="text-white/30 mx-1">|</span>
        <button
          type="button"
          onClick={() => { setMode('editing'); setZip(''); setError(null) }}
          className="text-amber-300 text-sm font-semibold hover:text-amber-200 transition-colors"
        >
          Try another ZIP →
        </button>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div
        className="inline-flex flex-col gap-2 px-4 py-3 rounded-2xl mb-6 max-w-lg"
        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-white text-sm font-bold">Couldn&apos;t load materials for that ZIP.</span>
        </div>
        {error?.kind === 'db_error' && (
          <div className="text-white/60 text-xs pl-6">
            {error.message}
          </div>
        )}
        <div className="pl-6">
          <button
            type="button"
            onClick={() => { setMode('editing'); setZip(''); setError(null) }}
            className="text-red-300 text-sm font-semibold hover:text-red-200 transition-colors"
          >
            Try again →
          </button>
        </div>
      </div>
    )
  }

  // editing
  return (
    <div className="mb-8">
      <div className="text-emerald-300 text-sm md:text-base font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
        <MapPin size={18} className="text-emerald-300" />
        Enter your ZIP to see materials & deals near you
      </div>
      <form
        onSubmit={submit}
        className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl shadow-emerald-500/40"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(16,185,129,0.08))',
          border: '2px solid rgba(16,185,129,0.7)',
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          autoFocus
          placeholder="ZIP code"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          className="bg-transparent outline-none text-white placeholder:text-white/50 text-2xl md:text-3xl font-extrabold w-44 tracking-widest"
          autoComplete="postal-code"
          aria-label="Enter your 5-digit ZIP code"
        />
        <button
          type="submit"
          disabled={zip.length !== 5 || loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 text-white text-base md:text-lg font-extrabold transition-colors shadow-lg shadow-emerald-500/40"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <>Go <ArrowRight size={20} /></>}
        </button>
        {currentMarketName && (
          <button
            type="button"
            onClick={() => { setMode('resting'); setZip('') }}
            className="text-white/50 hover:text-white/80 text-base ml-1"
            aria-label="Cancel"
          >
            ✕
          </button>
        )}
      </form>
    </div>
  )
}
