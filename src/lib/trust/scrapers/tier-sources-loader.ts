/**
 * Loads active source keys for a given trust-job tier from trust_source_registry,
 * gated by the entity's state_code.
 *
 * Filter rules:
 *   - is_active = true
 *   - tier ∈ applicable_tiers
 *   - applicable_state_codes IS NULL  (federal sources, fire on all states)
 *     OR state_code = ANY(applicable_state_codes)
 */

import { createAdminClient } from '@/lib/supabase/server'

const FALLBACK_BY_STATE: Record<string, string[]> = {
  CO: ['co_sos_biz', 'co_dora', 'denver_pim', 'sam_gov_exclusions'],
  TX: ['tx_sos_biz', 'tx_tdlr', 'tdlr_disciplinary', 'dallas_open_data', 'sam_gov_exclusions'],
}

const cache = new Map<string, { sources: string[]; cachedAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function sourcesForTier(tier: string, stateCode: string | null): Promise<string[]> {
  const cacheKey = `${tier}::${stateCode ?? 'NULL'}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.sources

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('trust_source_registry')
    .select('source_key, applicable_state_codes')
    .eq('is_active', true)
    .contains('applicable_tiers', [tier])

  if (error || !data) {
    console.error('[sourcesForTier] DB read failed, using fallback:', error?.message)
    if (stateCode && FALLBACK_BY_STATE[stateCode]) return FALLBACK_BY_STATE[stateCode]
    return FALLBACK_BY_STATE.CO || []
  }

  const filtered = data
    .filter((row: { source_key: string; applicable_state_codes: string[] | null }) => {
      if (!row.applicable_state_codes || row.applicable_state_codes.length === 0) return true
      if (!stateCode) return false
      return row.applicable_state_codes.includes(stateCode)
    })
    .map((row: { source_key: string }) => row.source_key)

  cache.set(cacheKey, { sources: filtered, cachedAt: Date.now() })
  return filtered
}

export function clearSourcesForTierCache(): void {
  cache.clear()
}
