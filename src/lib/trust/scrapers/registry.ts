import type { ScraperEvidence, ScraperResult, TrustFindingType, TrustConfidence } from './types';
import { ScraperError } from './types';
import { scrapeSamGovExclusions } from './sam-gov';
import { scrapeDallasPermits } from './dallas-open-data';
import { scrapeDenverPermits } from './denver-pim';
import { scrapeCoSosBiz } from './co-sos-biz';
import { scrapeTxSosBiz } from './tx-sos-biz';

/**
 * Source registry — maps source_key to a scraper invocation.
 *
 * Contract: every scraper takes (legalName, stateCode, optional city) and
 * returns a ScraperResult (ScraperEvidence | ScraperEvidence[]). Scrapers
 * throw typed ScraperError subclasses on infrastructure failure; permit-class
 * scrapers prefer to return a single 'unverified' informational row over
 * throwing so partial data still flows through the chain.
 *
 * runScraper normalizes single + array returns to ScraperEvidence[]. Existing
 * single-evidence scrapers (sam-gov etc.) keep their original signature.
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

async function dispatch(sourceKey: string, input: RunScraperInput): Promise<ScraperResult> {
  switch (sourceKey) {
    case 'sam_gov_exclusions':
      return scrapeSamGovExclusions({ legalName: input.legalName });

    case 'dallas_open_data':
      return scrapeDallasPermits({ legalName: input.legalName });

    case 'denver_pim':
      return scrapeDenverPermits({ legalName: input.legalName });

    case 'co_sos_biz':
      return scrapeCoSosBiz({ legalName: input.legalName });

    case 'tx_sos_biz':
      return scrapeTxSosBiz({ legalName: input.legalName });

    case 'mock_source':
      return mockScraperEvidence(input);

    case 'osha_est_search':
    case 'courtlistener_fed':
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

export async function runScraper(
  sourceKey: string,
  input: RunScraperInput,
): Promise<ScraperEvidence[]> {
  const r = await dispatch(sourceKey, input);
  return Array.isArray(r) ? r : [r];
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
// trust_tier_sources table for runtime config. Permit sources fan out via
// trust_source_registry.applicable_state_codes at the v2 fan-out layer, not
// per-tier, so they don't appear here.
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
