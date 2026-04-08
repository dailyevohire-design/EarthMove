'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { resolveMarketFromZip } from '@/lib/zip-market'
import { createClient } from '@/lib/supabase/client'

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
export function HeroZipPicker({ currentMarketName, currentMarketState }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'resting' | 'editing' | 'not-found'>(
    currentMarketName ? 'resting' : 'editing'
  )
  const [zip, setZip] = useState('')
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (zip.length !== 5) return

    setLoading(true)
    const match = resolveMarketFromZip(zip)
    if (!match) {
      setMode('not-found')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: market } = await supabase
      .from('markets')
      .select('id')
      .eq('slug', match.market_slug)
      .eq('is_active', true)
      .single()

    if (!market) {
      setMode('not-found')
      setLoading(false)
      return
    }

    document.cookie = `market_id=${market.id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    startTransition(() => {
      router.refresh()
      setLoading(false)
      setMode('resting')
      setZip('')
    })
  }

  if (mode === 'resting' && currentMarketName) {
    return (
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <MapPin size={14} className="text-emerald-400" />
        <span className="text-white/90 text-sm font-medium">
          Delivering to {currentMarketName}, {currentMarketState}
        </span>
        <span className="text-white/30 mx-1">|</span>
        <button
          type="button"
          onClick={() => setMode('editing')}
          className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors"
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
          onClick={() => { setMode('editing'); setZip('') }}
          className="text-amber-300 text-sm font-semibold hover:text-amber-200 transition-colors"
        >
          Try another ZIP →
        </button>
      </div>
    )
  }

  // editing
  return (
    <form
      onSubmit={submit}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
    >
      <MapPin size={14} className="text-emerald-400 ml-1" />
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        autoFocus
        placeholder="Enter ZIP"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
        className="bg-transparent outline-none text-white placeholder:text-white/40 text-sm font-medium w-24 tracking-wider"
        autoComplete="postal-code"
        aria-label="Enter your 5-digit ZIP code"
      />
      <button
        type="submit"
        disabled={zip.length !== 5 || loading}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 text-white text-xs font-bold transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <>Go <ArrowRight size={12} /></>}
      </button>
      {currentMarketName && (
        <button
          type="button"
          onClick={() => { setMode('resting'); setZip('') }}
          className="text-white/40 hover:text-white/70 text-xs ml-1"
          aria-label="Cancel"
        >
          ✕
        </button>
      )}
    </form>
  )
}
