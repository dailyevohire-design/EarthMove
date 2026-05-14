// Strict-name match wrapper for sec_edgar results.
//
// Problem: SEC EDGAR full-text search returns top-CIK hits even when the entity
// name doesn't match the query. Austin Industries (private TX contractor) was
// matched to Trinity Industries Inc (TX-based public rail-car manufacturer)
// because both contain "Industries" — sec_edgar then emitted business_inactive
// (Trinity's most recent filing is 2022) which contributed to the score's
// hard cap to 35 on a CRITICAL/F report.
//
// Fix: post-process any sec_edgar result. If the matched entity name does not
// pass strictNameMatch against the original query, downgrade the finding_type
// to source_not_applicable. The wrapper is pure — does not touch original code.
//
// The match is extracted from finding_summary using the canonical template
// "SEC EDGAR: N filings for "<entity name>" (CIK ...)". If the template is
// missing (e.g., the original returned business_not_found), the wrapper is a
// no-op pass-through.

import { strictNameMatch } from '../lib/html-scraper-helpers';
import type { ScraperEvidence } from '../types';

// Match the entity-name segment of the finding_summary template at
// src/lib/trust/scrapers/sec-edgar.ts:166 — uses ASCII double-quote.
const ENTITY_NAME_FROM_SUMMARY_PATTERN = /filings? for "([^"]+)"/i;

/**
 * Post-process a sec_edgar ScraperEvidence to enforce strict-name match.
 *
 * @param contractorName  The original query name passed to the scraper
 * @param result          Whatever sec_edgar's scrape function returned
 * @returns               The original result, OR a source_not_applicable
 *                        replacement if the matched entity name doesn't
 *                        strict-name match the query.
 */
export function enforceSecEdgarStrictMatch(
  contractorName: string,
  result: ScraperEvidence,
): ScraperEvidence {
  const typedFindings: ScraperEvidence['finding_type'][] = [
    'business_active',
    'business_inactive',
    'business_dissolved',
  ];
  if (!typedFindings.includes(result.finding_type)) return result;

  const m = ENTITY_NAME_FROM_SUMMARY_PATTERN.exec(result.finding_summary ?? '');
  if (!m) return result;
  const matchedName = m[1];

  if (strictNameMatch({ query: contractorName, candidate: matchedName, mode: 'contains' })) {
    return result;
  }

  return {
    ...result,
    finding_type: 'source_not_applicable',
    finding_summary: `SEC EDGAR: top hit "${matchedName}" does not strict-name match query "${contractorName}" — not a SEC filer or different entity. (Wrapper downgrade.)`,
    extracted_facts: {
      ...result.extracted_facts,
      strict_match_wrapper: {
        rejected_match: matchedName,
        original_finding_type: result.finding_type,
        original_summary: result.finding_summary,
      },
    },
  };
}
