/**
 * BBB Link Check — ToS-clean alternative to the paused bbb_profile direct
 * scraper (deactivated in migration 225). Constructs a deterministic
 * bbb.org search URL from the contractor's name + city + state. The user
 * follows the link to verify directly at bbb.org.
 *
 * NO HTTP. Does not fetch, parse, or cache any BBB content. Pure URL
 * construction. Per registry note (migration 229): ToS-compliant.
 *
 * The orchestrator persists the URL via raw_report.bbb so the renderer
 * can show a "View BBB Profile →" CTA in place of a rating tile.
 */

import type { ScraperEvidence, TrustConfidence } from './types';

const SOURCE_KEY = 'bbb_link_check';
const CONFIDENCE: TrustConfidence = 'verified_structured';

export interface BbbLinkCheckInput {
  legalName: string;
  city?: string | null;
  stateCode: string;
}

function constructBbbSearchUrl(name: string, city: string | null, stateCode: string): string {
  const enc = (s: string) => encodeURIComponent(s.trim());
  const findText = enc(name);
  if (city && city.trim().length > 0) {
    const findLoc = `${enc(city)}%2C+${stateCode.trim().toUpperCase()}`;
    return `https://www.bbb.org/search?find_text=${findText}&find_loc=${findLoc}&find_country=USA`;
  }
  return `https://www.bbb.org/search?find_text=${findText}&find_country=USA`;
}

export async function scrapeBbbLinkCheck(input: BbbLinkCheckInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) throw new Error('scrapeBbbLinkCheck: legalName required');

  const url = constructBbbSearchUrl(legalName, input.city ?? null, input.stateCode);

  return {
    source_key: SOURCE_KEY,
    finding_type: 'bbb_link_constructed',
    confidence: CONFIDENCE,
    finding_summary:
      'BBB profile link constructed for direct user verification (no automated content access — ToS compliant)',
    extracted_facts: {
      query_name: legalName,
      city: input.city ?? null,
      state_code: input.stateCode,
      bbb_search_url: url,
      citation_url: url,
      search_method: 'deterministic_url_construction',
    },
    query_sent: url,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  };
}
