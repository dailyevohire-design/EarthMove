/**
 * DB-driven tier → source resolver.
 *
 * Replaces the hardcoded TIER_SOURCES const in registry.ts with a runtime
 * query against trust_source_registry.applicable_tiers (added in migration
 * 200). Cached in module scope after first resolve to avoid re-querying on
 * every job. On DB read error, falls back to the original hardcoded set so
 * the scraper chain still functions during a Supabase outage.
 *
 * Public API stays compatible with sourcesForTier() callers.
 */

import { createAdminClient } from '@/lib/supabase/server';

type Tier = 'free' | 'standard' | 'plus' | 'deep_dive' | 'forensic';

const HARDCODED_FALLBACK: Record<Tier, string[]> = {
  free: ['mock_source'],
  standard:  ['sam_gov_exclusions', 'co_sos_biz', 'tx_sos_biz', 'denver_pim', 'dallas_open_data'],
  plus:      ['sam_gov_exclusions', 'co_sos_biz', 'tx_sos_biz', 'denver_pim', 'dallas_open_data'],
  deep_dive: ['sam_gov_exclusions', 'co_sos_biz', 'tx_sos_biz', 'denver_pim', 'dallas_open_data'],
  forensic:  ['sam_gov_exclusions', 'co_sos_biz', 'tx_sos_biz', 'denver_pim', 'dallas_open_data'],
};

let cache: Record<string, string[]> | null = null;

interface RegistryRow {
  source_key: string;
  applicable_tiers: string[] | null;
  is_active: boolean;
}

async function loadFromDb(): Promise<Record<string, string[]>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('trust_source_registry')
    .select('source_key, applicable_tiers, is_active');
  if (error) throw new Error(`tier-sources-loader: ${error.message}`);

  const rows = (data ?? []) as RegistryRow[];
  const grouped: Record<string, string[]> = { free: [], standard: [], plus: [], deep_dive: [], forensic: [] };
  for (const r of rows) {
    if (!r.is_active) continue;
    const tiers = r.applicable_tiers ?? [];
    for (const t of tiers) {
      if (t in grouped) grouped[t].push(r.source_key);
    }
  }
  for (const t of Object.keys(grouped)) grouped[t].sort();
  return grouped;
}

export async function loadTierSources(): Promise<Record<string, string[]>> {
  if (cache) return cache;
  try {
    cache = await loadFromDb();
    return cache;
  } catch (err) {
    console.error('[tier-sources-loader] DB read failed; falling back to hardcoded set', err);
    return HARDCODED_FALLBACK as Record<string, string[]>;
  }
}

export async function sourcesForTierAsync(tier: string): Promise<string[]> {
  const map = await loadTierSources();
  return map[tier] ?? map['standard'] ?? HARDCODED_FALLBACK.standard;
}

// Test-only: reset cache so unit tests can exercise the load path.
export function _resetTierSourcesCache(): void {
  cache = null;
}

// Test-only: get the hardcoded fallback set (asserted in tests).
export function _getHardcodedFallback(): Record<Tier, string[]> {
  return HARDCODED_FALLBACK;
}
