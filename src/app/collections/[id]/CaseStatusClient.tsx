'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type CaseRow = {
  id: string
  status: string
  state_code: 'CO' | 'TX'
  claimant_name: string
  respondent_name: string
  property_street_address: string
  property_city: string
  property_state: 'CO' | 'TX'
  property_zip: string
  amount_owed_cents: number
  paid_at: string | null
  documents_generated_at: string | null
  first_downloaded_at: string | null
  download_count: number
  created_at: string
}

type Urls = {
  demand_letter: string
  doc2: string
  lien: string
  doc2_type: 'notice_of_intent' | 'pre_lien_notice'
} | null

export default function CaseStatusClient({ caseRow }: { caseRow: CaseRow }) {
  const [status, setStatus] = useState(caseRow.status)
  const [urls, setUrls] = useState<Urls>(null)
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  // Poll while paid but docs not ready
  useEffect(() => {
    if (status === 'paid' && !caseRow.documents_generated_at) {
      const t = setInterval(() => setRefreshCount(c => c + 1), 4000)
      return () => clearInterval(t)
    }
  }, [status, caseRow.documents_generated_at])

  useEffect(() => {
    if (refreshCount === 0) return
    ;(async () => {
      const res = await fetch(`/api/collections/${caseRow.id}`, { cache: 'no-store' })
      if (!res.ok) return
      const fresh = await res.json()
      if (fresh?.status) setStatus(fresh.status)
    })()
  }, [refreshCount, caseRow.id])

  async function loadUrls() {
    if (loadingDownload) return
    setLoadingDownload(true)
    try {
      const res = await fetch(`/api/collections/${caseRow.id}/download`, { cache: 'no-store' })
      if (res.status === 202) {
        setStatus('paid')
        return
      }
      if (res.status === 410) { setStatus('refunded'); return }
      if (!res.ok) return
      const data = await res.json()
      setUrls(data)
      setStatus('downloaded')
    } finally {
      setLoadingDownload(false)
    }
  }

  if (status === 'refunded') {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">
        This case has been refunded. Documents are no longer accessible.
      </div>
    )
  }

  if (status === 'draft' || status === 'pending_payment') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
          Your case is {status === 'draft' ? 'a draft' : 'awaiting payment'}. Resume capability is not in v0 — please start a new case to pay.
        </div>
        <Link href="/collections/new" className="inline-block px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Start a new case</Link>
      </div>
    )
  }

  if (status === 'paid') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span>Generating your documents… This usually takes a few seconds.</span>
        </div>
      </div>
    )
  }

  // documents_ready or downloaded
  const coState = caseRow.state_code === 'CO'
  const labels = coState
    ? { demand: 'Demand Letter', doc2: 'Notice of Intent to Lien', lien: 'Statement of Mechanic’s Lien' }
    : { demand: 'Demand Letter', doc2: 'Pre-Lien Notice (§ 53.056)', lien: 'Lien Affidavit (§ 53.054)' }

  const amber = coState
    ? "DO NOT FILE WITHOUT ATTORNEY REVIEW — Have a Colorado-licensed attorney review before filing with the county recorder. Improperly filed liens create liability under C.R.S. § 38-22-128."
    : "DO NOT FILE WITHOUT ATTORNEY REVIEW — Have a Texas-licensed attorney review before filing with the county clerk. Improperly filed liens create liability under Tex. Prop. Code § 53.156. For subcontractors, the attorney should confirm § 53.056 notice compliance."

  return (
    <div className="space-y-5">
      {!urls && (
        <button
          onClick={loadUrls}
          disabled={loadingDownload}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold"
        >
          {loadingDownload ? 'Preparing downloads…' : 'Prepare downloads'}
        </button>
      )}

      {urls && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DownloadCard label={labels.demand} url={urls.demand_letter} />
          <DownloadCard label={labels.doc2}   url={urls.doc2} />
          <DownloadCard label={labels.lien}   url={urls.lien} />
        </div>
      )}

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 leading-relaxed">
        {amber}
      </div>

      <div className="text-xs text-stone-500">
        Downloads: {caseRow.download_count}{caseRow.first_downloaded_at ? ` · first: ${new Date(caseRow.first_downloaded_at).toLocaleString()}` : ''}
      </div>
    </div>
  )
}

function DownloadCard({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-emerald-400 hover:shadow-sm transition-all"
    >
      <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">PDF</div>
      <div className="mt-1 text-sm font-semibold text-stone-900">{label}</div>
      <div className="mt-2 text-xs text-emerald-700 underline">Download</div>
    </a>
  )
}
