import type { ScraperEvidence, ScraperResult, TrustFindingType, TrustConfidence } from './types';
import { ScraperError } from './types';
import { scrapeSamGovExclusions } from './sam-gov';
import { scrapeDallasPermits } from './dallas-open-data';
import { scrapeDenverPermits } from './denver-pim';
import { scrapeCoSosBiz } from './co-sos-biz';
import { scrapeTxSosBiz } from './tx-sos-biz';
import { scrapeCoDoraDiscipline } from './co-dora-discipline';
import { scrapeTxTdlrOrders } from './tx-tdlr-orders';
import { scrapeCourtListenerFed } from './courtlistener-fed';
import { scrapeStateAgEnforcement } from './state-ag-enforcement';
import { scrapeOshaEstSearch } from './osha-est-search';
import { scrapeBbbLinkCheck } from './bbb-link-check';
import { scrapeTdlrDisciplinary } from './tdlr-disciplinary';
import { scrapeFmcsaSafer } from './fmcsa-safer';
import { scrapeGoogleReviews } from './google-reviews';
import { scrapeSecEdgar } from './sec-edgar';

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
  /** Primary name (= nameVariants[0] when variants are provided). Kept for
   *  back-compat with callers that don't pass variants and for the dispatch
   *  switch which forwards a single name to each scraper. */
  legalName: string;
  /** PR #25 — top-N name variants for fallback iteration. Defaults to
   *  [legalName] when omitted. The runScraper loop tries variants in order
   *  and returns the first hit; on total miss it returns variant[0]'s
   *  evidence (a single *_not_found row, not N negative rows). */
  nameVariants?: string[];
  stateCode: string;
  city?: string | null;
}

// Finding-type suffixes that mark a "miss" — these don't terminate variant
// iteration; the runScraper loop continues to the next variant. Anything
// else (license_active, business_dissolved, sanction_hit, etc.) ends the
// loop and is returned as the hit.
const MISS_FINDING_SUFFIXES = [
  '_not_found', '_no_actions', '_no_record', '_no_violations',
  '_no_judgments', '_not_profiled', '_clear',
] as const

function isMissFinding(e: ScraperEvidence): boolean {
  if (e.finding_type === 'source_error' || e.finding_type === 'source_not_applicable') return true
  return MISS_FINDING_SUFFIXES.some((suffix) => e.finding_type.endsWith(suffix))
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

    case 'co_dora':
      return scrapeCoDoraDiscipline({ legalName: input.legalName });

    case 'tx_tdlr':
      return scrapeTxTdlrOrders({ legalName: input.legalName });

    case 'courtlistener_fed':
      return scrapeCourtListenerFed({ legalName: input.legalName });

    case 'state_ag_enforcement':
      return scrapeStateAgEnforcement({ legalName: input.legalName, stateCode: input.stateCode });

    case 'mock_source':
      return mockScraperEvidence(input);

    case 'osha_est_search':
      return scrapeOshaEstSearch({ legalName: input.legalName, stateCode: input.stateCode });

    case 'bbb_link_check':
      return scrapeBbbLinkCheck({
        legalName: input.legalName,
        city: input.city ?? null,
        stateCode: input.stateCode,
      });

    case 'tdlr_disciplinary':
      return scrapeTdlrDisciplinary({ legalName: input.legalName, stateCode: input.stateCode });

    case 'fmcsa_safer':
      return scrapeFmcsaSafer({ legalName: input.legalName });

    case 'google_reviews':
      return scrapeGoogleReviews({
        query_name: input.legalName,
        jurisdiction: input.stateCode,
        city: input.city,
      });

    case 'sec_edgar':
      return scrapeSecEdgar({
        query_name: input.legalName,
        jurisdiction: input.stateCode,
      });

    case 'denver_cpd':
    case 'cslb_ca':
    case 'roc_az':
    case 'ccb_or':
    case 'lni_wa':
    case 'dbpr_fl':
    case 'nclbgc_nc':
    case 'fl_sunbiz':
    case 'usaspending':
    case 'bbb_profile':
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
  const variants = input.nameVariants && input.nameVariants.length > 0
    ? input.nameVariants
    : [input.legalName];

  // PR #25 — variant iteration is performed at registry level (not per-scraper)
  // to keep the bug-fix scope minimal: scraper modules are unchanged. The
  // architectural intent (fall back through variants, emit a single
  // *_not_found per source on total miss) is preserved.
  let firstResult: ScraperEvidence[] | null = null;
  let firstError: unknown = null;

  for (let i = 0; i < variants.length; i++) {
    const variantName = variants[i];
    try {
      const r = await dispatch(sourceKey, { ...input, legalName: variantName });
      const arr = Array.isArray(r) ? r : [r];
      if (i === 0) firstResult = arr;
      // First variant that produces at least one non-miss finding wins.
      if (arr.some((e) => !isMissFinding(e))) return arr;
    } catch (err) {
      if (i === 0) firstError = err;
      // Fall through to next variant — some upstream sources (e.g. SOS) may
      // 404 on one form of the name and 200 on another. NotImplemented errors
      // re-throw on the last variant since the source isn't going to start
      // working.
      if (err instanceof NotImplementedScraperError) throw err;
    }
  }

  // No variant produced a hit. Return variant[0]'s evidence (single
  // *_not_found row); if variant[0] errored AND no later variant succeeded,
  // re-throw so the caller can persist a source_error attribution.
  if (firstResult) return firstResult;
  if (firstError) throw firstError;
  return [];
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

// Tier -> source list. DB-driven via trust_source_registry.applicable_tiers
// (migration 200). The loader caches in module scope after first read and
// falls back to a hardcoded set on DB error so the scraper chain still
// functions during a Supabase outage.
//
// Async signature: this is invoked from Inngest function steps which are
// already async, so the await cost is one DB round-trip per cold boot.
