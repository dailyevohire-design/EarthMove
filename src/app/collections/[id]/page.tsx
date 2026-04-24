import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCollectionsEnabled } from '@/lib/collections/feature-flag'
import CaseStatusClient from './CaseStatusClient'

export const metadata = { title: 'Case — earthmove.io' }

export default async function CollectionsCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!isCollectionsEnabled()) notFound()
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/collections/${id}`)

  const { data: caseRow } = await supabase
    .from('collections_cases')
    .select(
      'id, status, state_code, kit_variant, claimant_name, respondent_name, property_street_address, property_city, property_state, property_zip, amount_owed_cents, paid_at, documents_generated_at, first_downloaded_at, download_count, created_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (!caseRow) notFound()

  const checkoutParam = typeof sp.checkout === 'string' ? sp.checkout : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Case {caseRow.id.slice(0, 8)}</h1>
          <p className="text-xs text-stone-500 mt-1">
            {caseRow.state_code} · {caseRow.claimant_name} → {caseRow.respondent_name}
          </p>
        </div>
        <Link href="/collections" className="text-xs text-stone-600 hover:text-stone-900 underline">← All cases</Link>
      </div>

      {checkoutParam === 'cancelled' && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Checkout cancelled. You can return to your draft and pay when ready.
        </div>
      )}

      <CaseStatusClient caseRow={caseRow} />
    </div>
  )
}
