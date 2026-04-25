'use client'

import { useState } from 'react'

export function BrokerScreenOut() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/collections/broker-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? body?.error ?? `Error ${res.status}`)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-stone-900 mb-2">Your dispute is with the company that hired you.</h3>
      <p className="text-sm text-stone-700 leading-relaxed">
        The Contractor Payment Kit files mechanic&rsquo;s liens against project property. That&rsquo;s not the right tool when your beef is with a broker, dispatcher, or middleman company that hired you to haul or perform work — they&rsquo;re the one who owes you, and they don&rsquo;t own the project property.
      </p>
      <p className="text-sm text-stone-700 leading-relaxed mt-3">
        We&rsquo;re building a broker payment tool. Drop your email below and we&rsquo;ll notify you when it ships.
      </p>

      {submitted ? (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Got it — we&rsquo;ll email <span className="font-semibold">{email}</span> when the broker payment tool ships.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-sm"
          >
            {submitting ? 'Saving…' : 'Notify me'}
          </button>
        </form>
      )}
      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
    </div>
  )
}
