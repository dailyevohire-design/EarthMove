// Strict-name match wrapper for osha_est_search results.
//
// Problem: OSHA establishment search matches loosely on company keywords.
// Austin Industries query → returned VERA INDUSTRIES LLC inspection record →
// emitted osha_inspection_no_violation for the wrong entity, polluting the
// trust score with evidence from a different establishment.
//
// Pattern matches sec_edgar strict-name wrapper. Extract the quoted entity name
// from the finding_summary template, run through strictNameMatch. If it doesn't
// match the query, downgrade to source_not_applicable.

import { strictNameMatch } from '../lib/html-scraper-helpers';
import type { ScraperEvidence } from '../types';

// Matches the OSHA finding_summary template at osha-est-search.ts:67:
//   `OSHA: 3 inspections on file for "AUSTIN INDUSTRIES INC" — no citations`
// Permissive: matches any `for "<name>"` segment after `OSHA:`.
const ENTITY_NAME_FROM_SUMMARY_PATTERN = /OSHA:[^"]*for "([^"]+)"/i;

export function enforceOshaStrictMatch(
  contractorName: string,
  result: ScraperEvidence,
): ScraperEvidence {
  const typedFindings: ScraperEvidence['finding_type'][] = [
    'osha_inspection_no_violation',
    'osha_violation',
    'osha_serious_violation',
    'osha_violations_clean',
    'osha_serious_citation',
    'osha_willful_citation',
    'osha_repeat_citation',
    'osha_fatality_finding',
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
    finding_summary: `OSHA: top hit "${matchedName}" does not strict-name match query "${contractorName}" — different establishment. (Wrapper downgrade.)`,
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
