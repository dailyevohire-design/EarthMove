/**
 * Tier configuration for runTrustOrchestratorV2.
 *
 * Distinct from TIER_CONFIG in synthesize-v2-prompt.ts (which is the
 * synthesis-prompt config keyed off SynthesisTier). This module is the
 * orchestrator-side config: which scrapers, name-variant limit, synthesis
 * model, concurrency cap.
 */

import { sourcesForTier } from './scrapers/tier-sources-loader'

export type Tier = 'free' | 'standard' | 'plus' | 'deep_dive' | 'forensic'

/**
 * 230: dual-engine open-web config per tier. Drives orchestrator-v2's
 * open-web phase. Sweep is the Perplexity grounded-research call (free
 * tier gets it). Verify fan-out is the Claude web_search verification of
 * top-N adverse hits (standard+). Targeted queries are independent Claude
 * investigations (deep_dive+). Patent claim 6 — cross-engine corroboration.
 */
export interface OpenWebTierConfig {
  sweep_enabled: boolean
  verify_fanout_limit: number  // top-N Perplexity hits to verify with Claude
  targeted_queries_enabled: boolean
  sweep_lookback_months: number
  sweep_model: 'sonar' | 'sonar-pro'
}

export const OPEN_WEB_CONFIG: Record<Tier, OpenWebTierConfig> = {
  free:      { sweep_enabled: true, verify_fanout_limit: 0, targeted_queries_enabled: false, sweep_lookback_months: 12, sweep_model: 'sonar' },
  standard:  { sweep_enabled: true, verify_fanout_limit: 3, targeted_queries_enabled: false, sweep_lookback_months: 12, sweep_model: 'sonar' },
  plus:      { sweep_enabled: true, verify_fanout_limit: 5, targeted_queries_enabled: false, sweep_lookback_months: 18, sweep_model: 'sonar' },
  deep_dive: { sweep_enabled: true, verify_fanout_limit: 8, targeted_queries_enabled: true,  sweep_lookback_months: 24, sweep_model: 'sonar-pro' },
  forensic:  { sweep_enabled: true, verify_fanout_limit: 12, targeted_queries_enabled: true, sweep_lookback_months: 36, sweep_model: 'sonar-pro' },
}

/**
 * Subset of scraper source_keys whose modules export a candidate-search
 * function (searchCoSosCandidates, searchTxSosCandidates, etc.). Consumed
 * by the orchestrator's disambiguation fallback — when exact-match would
 * yield entity_not_found, the orchestrator iterates this list and pulls
 * top-N similar entities to surface in <EntityDisambiguationCard />.
 *
 * Add a source_key here only after that scraper module exports a
 * search<X>Candidates function returning Promise<EntityCandidate[]>.
 */
export const ENTITY_REGISTRY_SCRAPERS = ['co_sos_biz', 'tx_sos_biz'] as const

export interface TierConfig {
  runSynthesis: boolean
  nameVariantLimit: number
  synthesisModel: string | null
  /** Per-tier global concurrency cap (used for SAM.gov + other shared throttles). */
  maxConcurrent: number
  /**
   * Hardcoded fallback scraper set for free tier, since trust_source_registry
   * rows are not tier-mapped to 'free' (only standard/plus/deep_dive/forensic).
   * Paid tiers resolve via sourcesForTier(); this fallback is the spec's
   * launch-blocking free-tier scraper set.
   */
  freeTierScraperFallback?: { CO: string[]; TX: string[] }
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: {
    runSynthesis: false,
    nameVariantLimit: 3,
    synthesisModel: null,
    maxConcurrent: 3,
    freeTierScraperFallback: {
      CO: ['sam_gov_exclusions', 'co_sos_biz', 'co_dora', 'courtlistener_fed', 'state_ag_enforcement'],
      TX: ['sam_gov_exclusions', 'tx_sos_biz', 'tx_tdlr', 'courtlistener_fed', 'state_ag_enforcement'],
    },
  },
  standard:  { runSynthesis: true, nameVariantLimit: 5, synthesisModel: 'claude-sonnet-4-6', maxConcurrent: 10 },
  plus:      { runSynthesis: true, nameVariantLimit: 5, synthesisModel: 'claude-sonnet-4-6', maxConcurrent: 10 },
  deep_dive: { runSynthesis: true, nameVariantLimit: 5, synthesisModel: 'claude-opus-4-7',   maxConcurrent: 5 },
  forensic:  { runSynthesis: true, nameVariantLimit: 5, synthesisModel: 'claude-opus-4-7',   maxConcurrent: 3 },
}

/**
 * Resolve the ordered scraper source_keys for a given tier + state.
 * Free tier reads from the hardcoded fallback (CO/TX only — other states
 * return empty, which buildEvidenceDerivedReport treats as entity_not_found).
 * Paid tiers delegate to sourcesForTier() which queries trust_source_registry.
 */
export async function resolveScrapersForTier(tier: Tier, state: string): Promise<string[]> {
  if (tier === 'free') {
    const fallback = TIER_CONFIG.free.freeTierScraperFallback
    if (!fallback) return []
    const stateKey = state.toUpperCase()
    if (stateKey === 'CO' || stateKey === 'TX') return fallback[stateKey]
    return []
  }
  return sourcesForTier(tier, state)
}
