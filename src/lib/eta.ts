// src/lib/eta.ts
// Resolve drive time (minutes) from a customer ZIP to a supply yard.
// Used by the time-based delivery rule in pricing-engine.ts and the /browse
// pages that display all-in delivered prices.
//
// Layered resolution (cheap → expensive):
//   1. zip_yard_drive_times cache row → return cached minutes.
//   2. Mapbox Directions API (if MAPBOX_TOKEN set) → store + return.
//   3. Heuristic: miles × 1.5 (DFW metro buffered) → return.
//
// Server-side only; uses createAdminClient so cache writes succeed under
// public route handlers.

import { createAdminClient } from '@/lib/supabase/server'

const HEURISTIC_MIN_PER_MILE = 1.5
const MAPBOX_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving'
const MAPBOX_TIMEOUT_MS = 4000

export interface DriveTime {
  miles: number
  minutes: number
  source: 'cache' | 'mapbox' | 'heuristic'
}

interface YardCoords {
  yard_id: string
  lat: number
  lng: number
}

interface ZipCoords {
  zip: string
  lat: number
  lng: number
}

/**
 * Resolve drive minutes from a customer ZIP to a yard. Returns null if the
 * customer ZIP is unknown (no centroid row).
 */
export async function resolveDriveMinutes(
  zip: string,
  yard: YardCoords,
): Promise<DriveTime | null> {
  if (!/^\d{5}$/.test(zip)) return null

  const supabase = createAdminClient()

  // 1. Cache hit
  const { data: cached } = await supabase
    .from('zip_yard_drive_times')
    .select('miles, drive_minutes, source')
    .eq('zip', zip)
    .eq('yard_id', yard.yard_id)
    .maybeSingle()

  if (cached && cached.drive_minutes != null && cached.miles != null) {
    return {
      miles: Number(cached.miles),
      minutes: Number(cached.drive_minutes),
      source: 'cache',
    }
  }

  // Customer ZIP centroid — needed for both Mapbox call and heuristic.
  const { data: zc } = await supabase
    .from('zip_centroids')
    .select('lat, lng')
    .eq('zip', zip)
    .maybeSingle()

  if (!zc || typeof zc.lat !== 'number' || typeof zc.lng !== 'number') return null

  const customer: ZipCoords = { zip, lat: zc.lat, lng: zc.lng }
  const miles = haversineMiles(customer.lat, customer.lng, yard.lat, yard.lng)

  // 2. Mapbox if configured
  const mapboxResult = await tryMapbox(customer, yard)
  if (mapboxResult) {
    await supabase.from('zip_yard_drive_times').upsert({
      zip,
      yard_id: yard.yard_id,
      miles: mapboxResult.miles,
      drive_minutes: mapboxResult.minutes,
      source: 'mapbox',
    })
    return { ...mapboxResult, source: 'mapbox' }
  }

  // 3. Heuristic fallback — do NOT cache (we want to retry Mapbox once a
  //    token is configured rather than serve a stale heuristic forever).
  return { miles, minutes: miles * HEURISTIC_MIN_PER_MILE, source: 'heuristic' }
}

async function tryMapbox(
  customer: ZipCoords,
  yard: YardCoords,
): Promise<{ miles: number; minutes: number } | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null

  const coords = `${customer.lng},${customer.lat};${yard.lng},${yard.lat}`
  const url = `${MAPBOX_BASE}/${coords}?access_token=${token}&overview=false&geometries=geojson`

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), MAPBOX_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const json = (await res.json()) as {
      routes?: { duration?: number; distance?: number }[]
    }
    const route = json.routes?.[0]
    if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
      return null
    }
    return {
      miles: Math.round((route.distance / 1609.344) * 100) / 100,
      minutes: Math.round((route.duration / 60) * 10) / 10,
    }
  } catch {
    return null
  }
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
