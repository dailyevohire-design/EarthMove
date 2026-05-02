import { createAdminClient } from '@/lib/supabase/server'

const HAVERSINE_FALLBACK_DEFAULT_MILES = 15

interface ResolvedDistance {
  miles: number
  source: 'zip_rpc' | 'haversine_fallback' | 'default_fallback'
  zip: string
  yardId: string
}

export async function resolveDistanceMiles({
  zip,
  yardId,
  yardLat,
  yardLng,
  marketCenterLat,
  marketCenterLng,
}: {
  zip: string | undefined
  yardId: string
  yardLat: number | null
  yardLng: number | null
  marketCenterLat: number | null
  marketCenterLng: number | null
}): Promise<ResolvedDistance> {
  if (!zip || !/^\d{5}$/.test(zip)) {
    return { miles: HAVERSINE_FALLBACK_DEFAULT_MILES, source: 'default_fallback', zip: zip ?? '', yardId }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .rpc('zip_to_yard_miles', { p_zip: zip, p_yard_id: yardId })

  if (!error && typeof data === 'number') {
    return { miles: data, source: 'zip_rpc', zip, yardId }
  }

  if (
    typeof yardLat === 'number' && typeof yardLng === 'number' &&
    typeof marketCenterLat === 'number' && typeof marketCenterLng === 'number'
  ) {
    const miles = haversineMiles(marketCenterLat, marketCenterLng, yardLat, yardLng)
    console.warn(JSON.stringify({
      event: 'pricing.zip_uncovered',
      zip, yardId, miles, source: 'haversine_market_center',
    }))
    return { miles, source: 'haversine_fallback', zip, yardId }
  }

  console.warn(JSON.stringify({
    event: 'pricing.zip_uncovered_no_coords',
    zip, yardId,
  }))
  return { miles: HAVERSINE_FALLBACK_DEFAULT_MILES, source: 'default_fallback', zip, yardId }
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.7613
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
}
