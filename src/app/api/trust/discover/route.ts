/**
 * POST /api/trust/discover — fast entity-registry-only lookup.
 *
 * Two-step confirmation flow part 1. Runs ONLY the entity-registry scrapers
 * (CO + TX SOS) and returns ranked candidates. ~1-2s budget. NO synthesis,
 * NO full pipeline. The frontend then surfaces a ConfirmationStep card; the
 * user picks an entity; the frontend re-POSTs to /api/trust with
 * confirmed_from_discovery.
 *
 * Body: { name, city, state_code, tier? }
 * Response: {
 *   exact_match: EntityCandidate | null,
 *   candidates: EntityCandidate[],   // top 5, may include exact_match at [0]
 *   zero_results: boolean,
 *   discovery_id: string             // ephemeral uuid for client-side dedup
 * }
 *
 * No DB writes. No persistence. The exact_match + candidates objects round-
 * trip to the client; the client passes the chosen entity_id + entity_source
 * back when re-POSTing to /api/trust. This keeps discovery cheap and avoids
 * a new table for transient state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { searchCoSosCandidates } from '@/lib/trust/scrapers/co-sos-biz'
import { searchTxSosCandidates } from '@/lib/trust/scrapers/tx-sos-biz'
import { rankCandidates, normalizeForCompare } from '@/lib/trust/name-similarity'
import type { EntityCandidate } from '@/lib/trust/scrapers/types'

export const runtime = 'nodejs'
export const maxDuration = 10 // 10s ceiling — discovery should average ~1-2s

interface DiscoverBody {
  name?: unknown
  city?: unknown
  state_code?: unknown
  tier?: unknown
}

export async function POST(req: NextRequest) {
  let body: DiscoverBody
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const stateCode = typeof body.state_code === 'string' ? body.state_code.trim().toUpperCase() : ''
  const city = typeof body.city === 'string' ? body.city.trim() : null
  if (name.length < 2) return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
  if (!/^[A-Z]{2}$/.test(stateCode)) return NextResponse.json({ error: 'invalid_state_code' }, { status: 400 })

  // Dispatch only the registries that have searchCandidates implementations.
  // Other states' lookups will become available as those scrapers grow
  // candidate-search support; today CO + TX cover the launch markets.
  const dispatch: Record<string, ((input: { legalName: string }) => Promise<EntityCandidate[]>) | null> = {
    CO: (input) => searchCoSosCandidates(input, 20),
    TX: (input) => searchTxSosCandidates(input, 20),
  }
  const lookup = dispatch[stateCode] ?? null
  if (!lookup) {
    return NextResponse.json({
      exact_match: null,
      candidates: [],
      zero_results: true,
      discovery_id: randomUUID(),
      reason: `entity registry candidate-search not yet wired for ${stateCode}`,
    })
  }

  let candidates: EntityCandidate[] = []
  try {
    candidates = await lookup({ legalName: name })
  } catch (err) {
    // Discovery is opportunistic. On scraper error, return empty rather than
    // failing the request; the frontend will fall through to the regular
    // entity_not_found flow on the subsequent POST /api/trust call.
    console.warn('[discover] candidate lookup failed', { stateCode, name, err: (err as Error)?.message })
    candidates = []
  }

  // Re-rank across the union (defensive — each scraper already ranked locally).
  const ranked = rankCandidates(name, candidates, { limit: 5 })

  // Exact match: candidate whose normalized entity_name equals the
  // normalized query verbatim. Top-similarity candidate may be a
  // typo-forgiveness hit; we want a separate "exact" signal.
  const queryNormalized = normalizeForCompare(name)
  const exactMatch = ranked.find((c) => normalizeForCompare(c.entity_name) === queryNormalized) ?? null

  return NextResponse.json({
    exact_match: exactMatch,
    candidates: ranked,
    zero_results: ranked.length === 0,
    discovery_id: randomUUID(),
    query: { name, city, state_code: stateCode },
  })
}
