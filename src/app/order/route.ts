import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

const DENVER = /^80\d{3}$/
const DFW = /^(75|76)\d{3}$/

const getMarketIdBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('markets')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    return data?.id ?? null
  },
  ['market-id-by-slug'],
  { revalidate: 3600, tags: ['markets'] },
)

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')?.trim() ?? ''
  let slug: 'denver' | 'dallas-fort-worth' | null = null
  if (DENVER.test(zip)) slug = 'denver'
  else if (DFW.test(zip)) slug = 'dallas-fort-worth'

  const url = req.nextUrl.clone()
  url.pathname = '/browse'
  url.search = ''

  if (!slug) {
    // ZIP outside service area: bounce back to homepage with error flag,
    // not /browse (no market context to filter against).
    const errUrl = req.nextUrl.clone()
    errUrl.pathname = '/'
    errUrl.search = ''
    errUrl.searchParams.set('zip_error', '1')
    return NextResponse.redirect(errUrl)
  }

  const marketId = await getMarketIdBySlug(slug)
  if (!marketId) {
    const errUrl = req.nextUrl.clone()
    errUrl.pathname = '/'
    errUrl.search = ''
    errUrl.searchParams.set('zip_error', '1')
    return NextResponse.redirect(errUrl)
  }

  const res = NextResponse.redirect(url)
  res.cookies.set('market_id', marketId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
