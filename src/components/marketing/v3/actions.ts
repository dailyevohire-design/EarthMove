'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveMarketFromZip } from '@/lib/zip-market'

// Strict allowlist — only the two markets actually live today.
// LAUNCH_MARKET_SLUGS in zip-market.ts is misnamed and includes expansion zips.
const LIVE_MARKET_SLUGS = ['denver', 'dallas-fort-worth'] as const
type LiveMarketSlug = (typeof LIVE_MARKET_SLUGS)[number]

function isLive(slug: string): slug is LiveMarketSlug {
  return (LIVE_MARKET_SLUGS as readonly string[]).includes(slug)
}

export async function startQuoteAction(formData: FormData) {
  const zip = String(formData.get('zip') ?? '').trim()
  const project = String(formData.get('project') ?? '').trim()

  if (!/^\d{5}$/.test(zip)) {
    redirect('/?zip_error=invalid')
  }
  const match = resolveMarketFromZip(zip)
  if (!match || !isLive(match.market_slug)) {
    redirect(`/?zip_error=oos&zip=${zip}`)
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('markets')
    .select('id')
    .eq('slug', match!.market_slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!row?.id) {
    redirect('/?zip_error=db')
  }

  const cookieStore = await cookies()
  cookieStore.set('market_id', row!.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  cookieStore.set('customer_zip', zip, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  if (project) {
    // /order/route.ts currently strips searchParams, so we persist the project
    // selection via cookie and let downstream surfaces (the order wizard or
    // /projects/[slug]) read it.
    cookieStore.set('project_intent', project, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    redirect(`/projects/${project}`)
  }
  redirect(`/order?zip=${zip}`)
}
