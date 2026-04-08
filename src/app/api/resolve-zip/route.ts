import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveMarketFromZip, LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'

/**
 * POST /api/resolve-zip
 * Body: { zip: string }
 *
 * Resolves a 5-digit ZIP to a launch market and returns the market_id.
 * Tries the anon client first; falls back to the service-role client so
 * a missing/inactive row or RLS misconfig still surfaces a real answer
 * instead of silently failing in the browser.
 *
 * Returns:
 *   200 { ok: true, market: { id, slug, name } }
 *   200 { ok: false, reason: 'invalid_zip' | 'out_of_area' | 'market_not_found' | 'db_error', detail?: string }
 */
export async function POST(req: Request) {
  let zip: string
  try {
    const body = await req.json()
    zip = String(body?.zip ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_zip' as const }, { status: 400 })
  }

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ ok: false, reason: 'invalid_zip' as const })
  }

  const match = resolveMarketFromZip(zip)
  if (!match) {
    return NextResponse.json({ ok: false, reason: 'out_of_area' as const })
  }

  // Sanity check: only resolve to actual launch markets
  if (!(LAUNCH_MARKET_SLUGS as readonly string[]).includes(match.market_slug)) {
    return NextResponse.json({ ok: false, reason: 'out_of_area' as const })
  }

  // Try anon (RLS-aware) first
  try {
    const supabase = await createClient()
    const { data: row, error } = await supabase
      .from('markets')
      .select('id, slug, name, is_active')
      .eq('slug', match.market_slug)
      .maybeSingle()

    if (row?.is_active && row.id) {
      return NextResponse.json({
        ok: true as const,
        market: { id: row.id, slug: row.slug, name: row.name },
      })
    }
    if (error) {
      console.error('[resolve-zip] anon query error:', error)
    } else if (row && !row.is_active) {
      console.warn('[resolve-zip] market exists but is_active=false:', match.market_slug)
    } else {
      console.warn('[resolve-zip] anon query returned no row for slug:', match.market_slug)
    }
  } catch (err) {
    console.error('[resolve-zip] anon query threw:', err)
  }

  // Fall back to admin (bypasses RLS) — useful when RLS is the actual cause
  try {
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('markets')
      .select('id, slug, name, is_active')
      .eq('slug', match.market_slug)
      .maybeSingle()

    if (error) {
      console.error('[resolve-zip] admin query error:', error)
      return NextResponse.json({
        ok: false as const,
        reason: 'db_error' as const,
        detail: error.message,
      })
    }

    if (!row) {
      console.error('[resolve-zip] no row in markets for slug:', match.market_slug)
      return NextResponse.json({
        ok: false as const,
        reason: 'market_not_found' as const,
        detail: `No row with slug='${match.market_slug}' in markets table.`,
      })
    }

    if (!row.is_active) {
      console.error('[resolve-zip] market is_active=false for slug:', match.market_slug)
      return NextResponse.json({
        ok: false as const,
        reason: 'market_not_found' as const,
        detail: `Row with slug='${match.market_slug}' exists but is_active=false.`,
      })
    }

    // Admin found it. Return success — the launch market exists, just not
    // visible to anon. The cookie set by the picker is enough to make the
    // homepage server query (which uses the same anon RLS) work, so we still
    // need anon to be able to read this row. Surface a hint in detail.
    return NextResponse.json({
      ok: true as const,
      market: { id: row.id, slug: row.slug, name: row.name },
      detail: 'Resolved via admin fallback — anon query did not see this row. Check RLS policy on markets table.',
    })
  } catch (err: any) {
    console.error('[resolve-zip] admin query threw:', err)
    return NextResponse.json({
      ok: false as const,
      reason: 'db_error' as const,
      detail: err?.message ?? 'unknown',
    })
  }
}
