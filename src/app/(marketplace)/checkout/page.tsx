// Server component for /checkout. Reads URL params from /material-match
// hand-off, resolves user context + WELCOME5 eligibility + price quote, then
// hands everything to <CheckoutClient> for the form/summary UI.
//
// Required URL params: material_catalog_id, tons. If either missing,
// redirect to /material-match. Other params (zip, project_type, sub_type,
// delivery_window) are pre-fills.
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getUserContext } from '@/lib/user-context'
import { createClient } from '@/lib/supabase/server'
import { quoteOrder, computeWelcome5DiscountCents } from '@/lib/checkout/pricing'
import { CheckoutClient } from './CheckoutClient'

export const dynamic = 'force-dynamic'

interface SearchParams {
  material_catalog_id?: string
  material?: string
  tons?: string
  zip?: string
  project_type?: string
  sub_type?: string
  delivery_window?: string
  source?: string
  guest?: string
  cancelled?: string
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tons = params.tons ? parseFloat(params.tons) : 0

  if (!params.material_catalog_id || !Number.isFinite(tons) || tons <= 0) {
    redirect('/material-match')
  }

  const ctx = await getUserContext()

  // Guest path is opt-in via ?guest=1 (from /checkout/start) or default for
  // unauthenticated visitors. Authed users with ?guest=1 still proceed authed
  // (we shouldn't sign them out just because the URL says guest).
  const isGuest = !ctx.isAuthenticated

  // WELCOME5 eligibility — authed only, profile.signup_promo_redeemed_at IS NULL
  let welcome5Eligible = false
  if (ctx.isAuthenticated && ctx.userId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('signup_promo_redeemed_at')
      .eq('id', ctx.userId)
      .single()
    welcome5Eligible = !!data && data.signup_promo_redeemed_at === null
  }

  const quote = quoteOrder({
    material_catalog_id: params.material_catalog_id,
    material_name: params.material,
    tons,
  })

  const welcome5DiscountCents = welcome5Eligible
    ? computeWelcome5DiscountCents(quote.subtotalCents)
    : 0

  const finalTotalCents = quote.totalCents - welcome5DiscountCents

  const cancelled = params.cancelled === '1'

  return (
    <Suspense fallback={<div className="bg-[#faf7f2] min-h-screen" />}>
      <CheckoutClient
        material_catalog_id={params.material_catalog_id}
        materialName={quote.materialName}
        tons={tons}
        zipPrefill={params.zip ?? ''}
        deliveryWindow={params.delivery_window ?? null}
        projectType={params.project_type ?? null}
        subType={params.sub_type ?? null}
        isGuest={isGuest}
        userEmail={ctx.user?.email ?? null}
        userFirstName={ctx.profile?.first_name ?? null}
        userLastName={ctx.profile?.last_name ?? null}
        userPhone={ctx.profile?.phone ?? null}
        welcome5Eligible={welcome5Eligible}
        pricePerTonCents={quote.pricePerTonCents}
        subtotalCents={quote.subtotalCents}
        deliveryFeeCents={quote.deliveryFeeCents}
        welcome5DiscountCents={welcome5DiscountCents}
        finalTotalCents={finalTotalCents}
        cancelled={cancelled}
      />
    </Suspense>
  )
}
