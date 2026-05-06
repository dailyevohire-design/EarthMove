// scripts/prewarm-zip-yard-drive-times.ts
// One-shot: warm zip_yard_drive_times for every plausible (zip, yard) pair
// in the DFW + Denver launch markets so the first /browse render for any
// new customer hits the cache instead of a cold Mapbox call.
//
// Usage:
//   pnpm exec vercel env pull .env.local        # ensure MAPBOX_TOKEN is local
//   pnpm exec tsx scripts/prewarm-zip-yard-drive-times.ts
//
// Idempotent — resolveDriveMinutes hits the cache first, only calls Mapbox
// on misses. Rerun safely.

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
dotenvConfig({ path: '.env' }) // fallback, doesn't override values already loaded
import { resolveDriveMinutes } from '../src/lib/eta'
import { createAdminClient } from '../src/lib/supabase/server'

// Concurrency: Mapbox Directions free tier is 300 req/min. 3 parallel ×
// ~500ms each = ~360/min — modestly over but acceptable; first run at 5
// concurrent saw ~50% 429 fallbacks to heuristic, this should drop to <10%.
const CONCURRENCY = 3
// Pre-filter: skip pairs farther than this haversine distance — they'll be
// outside the 30-mi delivery radius anyway and resolveDriveMinutes would
// reject them.
const MAX_HAVERSINE_MILES = 35

// Launch market zip prefixes (3-digit). Mirrors src/lib/zip-market.ts.
const DFW_PREFIXES = [
  ...range(750, 758), ...range(760, 766), 768, 769,
]
const DENVER_PREFIXES = range(800, 810)
const LAUNCH_PREFIXES = new Set([...DFW_PREFIXES, ...DENVER_PREFIXES])

function range(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.7613
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function pmap<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  if (!process.env.MAPBOX_TOKEN) {
    console.error('✗ MAPBOX_TOKEN not in env. Run: pnpm exec vercel env pull .env.local')
    process.exit(1)
  }

  const supabase = createAdminClient()

  // 1. Launch yards = yards in launch markets with ≥1 public+available offering.
  //    Denver has ~1100 scraped placeholder yards we don't want to warm; the
  //    join below filters to actual launch suppliers (NTNM, Verdego, etc).
  const { data: launchYardIds, error: yidErr } = await supabase
    .from('supplier_offerings')
    .select('supply_yard_id, supply_yard:supply_yards!inner(id, name, lat, lng, is_active, market:markets!inner(slug))')
    .eq('is_public', true)
    .eq('is_available', true)
    .eq('supply_yard.is_active', true)
    .in('supply_yard.market.slug', ['dallas-fort-worth', 'denver'])
  if (yidErr) throw yidErr

  type YardJoin = { supply_yard: { id: string; name: string | null; lat: number | null; lng: number | null } }
  const yardMap = new Map<string, { id: string; name: string; lat: number; lng: number }>()
  for (const r of (launchYardIds ?? []) as unknown as YardJoin[]) {
    const y = r.supply_yard
    if (!y || typeof y.lat !== 'number' || typeof y.lng !== 'number') continue
    yardMap.set(y.id, { id: y.id, name: y.name ?? '(unnamed)', lat: y.lat, lng: y.lng })
  }
  const activeYards = Array.from(yardMap.values())
  console.log(`✓ ${activeYards.length} launch yards (with public+available offerings)`)

  // 2. Launch-market zips (loaded in batches to stay under PostgREST row caps).
  const zips: { zip: string; lat: number; lng: number }[] = []
  for (const prefix of LAUNCH_PREFIXES) {
    const lo = `${prefix}00`
    const hi = `${prefix}99`
    const { data, error } = await supabase
      .from('zip_centroids')
      .select('zip, lat, lng')
      .gte('zip', lo)
      .lte('zip', hi)
    if (error) throw error
    for (const z of data ?? []) {
      if (typeof z.lat === 'number' && typeof z.lng === 'number') {
        zips.push({ zip: z.zip, lat: z.lat, lng: z.lng })
      }
    }
  }
  console.log(`✓ ${zips.length} zip centroids in launch markets`)

  // 3. Build candidate pairs within MAX_HAVERSINE_MILES.
  type Pair = { zip: string; yardId: string; yardLat: number; yardLng: number }
  const pairs: Pair[] = []
  for (const z of zips) {
    for (const y of activeYards) {
      if (haversineMiles(z.lat, z.lng, y.lat, y.lng) > MAX_HAVERSINE_MILES) continue
      pairs.push({ zip: z.zip, yardId: y.id, yardLat: y.lat, yardLng: y.lng })
    }
  }
  console.log(`✓ ${pairs.length} (zip, yard) pairs within ${MAX_HAVERSINE_MILES} mi haversine`)

  // 4. Resolve in parallel. resolveDriveMinutes hits cache first, only calls
  //    Mapbox for misses, and writes the result back. Idempotent.
  let cacheHits = 0
  let mapboxCalls = 0
  let heuristic = 0
  let failed = 0
  let processed = 0
  const start = Date.now()

  await pmap(pairs, CONCURRENCY, async (p) => {
    try {
      const r = await resolveDriveMinutes(p.zip, {
        yard_id: p.yardId, lat: p.yardLat, lng: p.yardLng,
      })
      if (!r) { failed++; return }
      if (r.source === 'cache') cacheHits++
      else if (r.source === 'mapbox') mapboxCalls++
      else heuristic++
    } catch {
      failed++
    } finally {
      processed++
      if (processed % 100 === 0 || processed === pairs.length) {
        const elapsed = Math.round((Date.now() - start) / 1000)
        console.log(
          `  ${processed}/${pairs.length} (${elapsed}s) — cache:${cacheHits} mapbox:${mapboxCalls} heuristic:${heuristic} fail:${failed}`
        )
      }
    }
  })

  const totalSec = Math.round((Date.now() - start) / 1000)
  console.log(`\nDone in ${totalSec}s`)
  console.log(`  Cache hits:    ${cacheHits}`)
  console.log(`  Mapbox calls:  ${mapboxCalls}`)
  console.log(`  Heuristic:     ${heuristic}  (Mapbox unavailable for these — re-run later)`)
  console.log(`  Failed:        ${failed}`)
  if (heuristic > 0) {
    console.log('\nNote: heuristic results are NOT cached, so a re-run will retry them via Mapbox.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
