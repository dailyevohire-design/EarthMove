import type { ScraperEvidence, TrustFindingType, TrustConfidence } from './types';
import { ScraperError } from './types';
import { scrapeSamGovExclusions } from './sam-gov';

/**
 * Source registry — maps source_key to a scraper invocation.
 *
 * Contract: every scraper takes (legalName, stateCode, optional contractor_id)
 * and returns a ScraperEvidence. Scrapers throw typed ScraperError subclasses
 * on failure; callers (Inngest fan-out) catch + record source_error evidence.
 *
 * Scrapers NOT YET BUILT throw NotImplementedError. The fan-out treats this
 * as a non-retryable failure so a misconfigured tier doesn't burn retries.
 */

export class NotImplementedScraperError extends ScraperError {}

export interface RunScraperInput {
  legalName: string;
  stateCode: string;
  city?: string | null;
}

export async function runScraper(
  sourceKey: string,
  input: RunScraperInput,
): Promise<ScraperEvidence> {
  switch (sourceKey) {
    case 'sam_gov_exclusions':
      return scrapeSamGovExclusions({ legalName: input.legalName });

    case 'mock_source':
      return mockScraperEvidence(input);

    case 'osha_est_search':
    case 'courtlistener_fed':
    case 'co_sos_biz':
    case 'tx_sos_biz':
    case 'denver_cpd':
    case 'cslb_ca':
    case 'roc_az':
    case 'ccb_or':
    case 'lni_wa':
    case 'dbpr_fl':
    case 'nclbgc_nc':
    case 'fl_sunbiz':
    case 'sec_edgar':
    case 'usaspending':
    case 'bbb_profile':
    case 'google_reviews':
      throw new NotImplementedScraperError(
        `Scraper for ${sourceKey} not yet implemented (Tranche B/C)`,
        sourceKey,
      );

    default:
      throw new NotImplementedScraperError(
        `Unknown source_key: ${sourceKey}`,
        sourceKey,
      );
  }
}

function mockScraperEvidence(input: RunScraperInput): ScraperEvidence {
  return {
    source_key: 'mock_source',
    finding_type: 'source_not_applicable' as TrustFindingType,
    confidence: 'low_inference' as TrustConfidence,
    finding_summary: `Mock scraper for "${input.legalName}" (${input.stateCode}) — no real data`,
    extracted_facts: { mock: true, legalName: input.legalName, stateCode: input.stateCode },
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 1,
    cost_cents: 0,
  };
}

// Tier -> source list. Hardcoded for C5; future commit moves this to a
// trust_tier_sources table for runtime config.
export const TIER_SOURCES: Record<string, string[]> = {
  free: ['mock_source'],
  standard: ['sam_gov_exclusions'],
  plus: ['sam_gov_exclusions'],
  deep_dive: ['sam_gov_exclusions'],
  forensic: ['sam_gov_exclusions'],
};

export function sourcesForTier(tier: string): string[] {
  return TIER_SOURCES[tier] ?? TIER_SOURCES.standard;
}
