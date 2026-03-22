'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resolveMarketFromZip } from '@/lib/zip-market'
import { createClient } from '@/lib/supabase/client'
import { MapPin, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export function ZipEntry() {
  const router = useRouter()
  const [zip, setZip] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'not-found' | 'success'>('idle')
  const [marketName, setMarketName] = useState('')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (zip.length !== 5) return

    setState('loading')
    const result = resolveMarketFromZip(zip)

    if (!result) {
      setState('not-found')
      return
    }

    setMarketName(result.market_name)

    // Fetch market ID from Supabase to set cookie
    const supabase = createClient()
    const { data: market } = await supabase
      .from('markets')
      .select('id')
      .eq('slug', result.market_slug)
      .eq('is_active', true)
      .single()

    if (market) {
      // Set market_id cookie (expires in 1 year)
      document.cookie = `market_id=${market.id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      setState('success')
      startTransition(() => {
        router.push('/browse')
      })
    } else {
      setState('not-found')
    }
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address.')
      return
    }

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, zip }),
      })
      if (res.ok) {
        setEmailSent(true)
      } else {
        setEmailError('Something went wrong. Please try again.')
      }
    } catch {
      setEmailError('Something went wrong. Please try again.')
    }
  }

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZip(val)
    // Reset state when user edits
    if (state === 'not-found') setState('idle')
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8 md:p-10">
        {state !== 'not-found' ? (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
                <MapPin size={24} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                Enter your zip code
              </h2>
              <p className="text-gray-500 mt-2 text-sm">
                We'll show you materials available for delivery in your area.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  placeholder="Enter zip code"
                  value={zip}
                  onChange={handleZipChange}
                  className="w-full text-center text-3xl md:text-4xl font-extrabold tracking-[0.2em] text-gray-900 placeholder:text-gray-300 placeholder:tracking-normal placeholder:text-xl placeholder:font-medium border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl px-6 py-5 outline-none transition-all"
                  autoFocus
                  autoComplete="postal-code"
                />
              </div>

              <button
                type="submit"
                disabled={zip.length !== 5 || state === 'loading' || pending}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-lg py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-600/20 disabled:shadow-none"
              >
                {state === 'loading' || pending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Finding your market...
                  </>
                ) : state === 'success' ? (
                  <>
                    <CheckCircle2 size={20} />
                    Redirecting to {marketName}...
                  </>
                ) : (
                  <>
                    Find Materials
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Coming Soon / Waitlist */
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 mb-4">
              <AlertCircle size={24} className="text-amber-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              Coming Soon!
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              We're not in zip code <span className="font-bold text-gray-700">{zip}</span> yet,
              but we're expanding fast. Get notified when we launch in your area.
            </p>

            {!emailSent ? (
              <form onSubmit={handleWaitlist} className="space-y-3">
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-center text-lg text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl px-6 py-4 outline-none transition-all"
                  autoFocus
                />
                {emailError && (
                  <p className="text-red-500 text-sm">{emailError}</p>
                )}
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-600/20"
                >
                  Notify Me
                </button>
              </form>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                <CheckCircle2 size={28} className="text-emerald-600 mx-auto mb-2" />
                <p className="text-emerald-800 font-bold">You're on the list!</p>
                <p className="text-emerald-600 text-sm mt-1">
                  We'll email you as soon as we launch in your area.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setState('idle'); setZip('') }}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Try a different zip code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
