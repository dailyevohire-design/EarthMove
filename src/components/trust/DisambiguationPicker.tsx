'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface AmbiguousCandidate {
  name: string
  address?: string | null
  entity_id?: string | null
  principal?: string | null
  formation_year?: number | null
  distinguishing_note?: string | null
}

interface Props {
  candidates: AmbiguousCandidate[]
  contractorName: string
  stateCode: string
  city: string | null
}

export default function DisambiguationPicker({ candidates, contractorName, stateCode, city }: Props) {
  const router = useRouter()
  const [submittingIdx, setSubmittingIdx] = useState<number | null>(null)
  const [errorIdx, setErrorIdx] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return (
      <section
        role="region"
        aria-label="Disambiguation — no candidates"
        className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900"
      >
        <p>
          We couldn&rsquo;t narrow down the businesses. Try adding the city or the principal&rsquo;s name to your search.
        </p>
      </section>
    )
  }

  async function pick(candidate: AmbiguousCandidate, idx: number) {
    setSubmittingIdx(idx)
    setErrorIdx(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/trust/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_name: candidate.name,
          state_code: stateCode,
          city: city ?? '',
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `Lookup failed (${res.status})`)
      }
      const data = await res.json()
      const reportId = data?.report_id
      if (!reportId) throw new Error('Lookup succeeded but returned no report id')
      router.push(`/dashboard/trust/report/${reportId}`)
    } catch (err) {
      setErrorIdx(idx)
      setErrorMsg(err instanceof Error ? err.message : 'Lookup failed')
      setSubmittingIdx(null)
    }
  }

  return (
    <section role="region" aria-label="Disambiguation picker" className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-bold mb-1">Multiple matches</div>
        <p>
          Multiple businesses matched &ldquo;{contractorName}&rdquo;. Confirm which one.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {candidates.map((c, idx) => {
          const isSubmitting = submittingIdx === idx
          const isDisabled = submittingIdx !== null && !isSubmitting
          return (
            <div
              key={c.entity_id ?? `${c.name}-${idx}`}
              className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-col gap-2"
            >
              <div className="font-semibold text-stone-900">{c.name}</div>
              {c.address && <div className="text-sm text-stone-600">{c.address}</div>}
              {(c.principal || c.formation_year) && (
                <div className="text-xs text-stone-500">
                  {c.principal}
                  {c.principal && c.formation_year ? ' · ' : ''}
                  {c.formation_year ? `formed ${c.formation_year}` : ''}
                </div>
              )}
              {c.distinguishing_note && (
                <div className="text-sm text-stone-700">{c.distinguishing_note}</div>
              )}
              <button
                type="button"
                onClick={() => pick(c, idx)}
                disabled={isSubmitting || isDisabled}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
              >
                {isSubmitting ? 'Looking up…' : 'This is the one'}
              </button>
              {errorIdx === idx && errorMsg && (
                <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {errorMsg}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
