import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function getAllMarkets() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('markets')
    .select('id, name, slug, state, center_lat, center_lng')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

export async function getCurrentMarket() {
  const cookieStore = await cookies()
  const marketCookie = cookieStore.get('market_id')?.value

  const supabase = await createClient()

  if (marketCookie) {
    const { data } = await supabase
      .from('markets')
      .select('id, name, slug, state, center_lat, center_lng')
      .eq('id', marketCookie)
      .eq('is_active', true)
      .single()
    if (data) return data
  }

  // Fallback to first active market
  const { data } = await supabase
    .from('markets')
    .select('id, name, slug, state, center_lat, center_lng')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return data
}
