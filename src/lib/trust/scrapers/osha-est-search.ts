/**
 * OSHA Establishment Search scraper — wraps the osha_lookup_findings()
 * SQL function (defined in migration 219). NO external HTTP at score time;
 * all DOL data is mirrored locally via the bulk ingestion pipeline.
 *
 * Maps lookup output to a single ScraperEvidence row with the most
 * specific osha_* finding_type given violation severity:
 *   willful_count > 0    → osha_willful_citation
 *   repeat_count > 0     → osha_repeat_citation
 *   serious_count > 0    → osha_serious_citation
 *   inspection_count > 0 → osha_inspection_no_violation (cleaner — they
 *                          had inspections but no citations)
 *   zero matches         → osha_violations_clean
 *
 * citation_url construction: most_recent activity_nr → osha.gov public
 * inspection detail page. The DOL portal accepts numeric activity_nrs
 * directly via the imis/establishment.inspection_detail endpoint.
 */

import { createAdminClient } from '@/lib/supabase/server';
import type { ScraperEvidence, TrustFindingType, TrustConfidence } from './types';

const SOURCE_KEY = 'osha_est_search';
const CONFIDENCE: TrustConfidence = 'verified_structured';

export interface OshaEstSearchInput {
  legalName: string;
  stateCode?: string | null;
  lookbackYears?: number;
}

interface OshaLookupRow {
  estab_id: string;
  name_match: string;
  match_similarity: number;
  inspection_count: number;
  serious_count: number;
  willful_count: number;
  repeat_count: number;
  other_count: number;
  total_current_penalty: number;
  most_recent_date: string | null;
  most_severe_type: 'S' | 'W' | 'R' | 'O' | null;
  activity_nrs: string[] | null;
  citation_ids: string[] | null;
}

function inspectionCitationUrl(activityNr: string | null): string | null {
  if (!activityNr) return null;
  return `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=${encodeURIComponent(activityNr)}`;
}

function selectFindingType(top: OshaLookupRow): TrustFindingType {
  if (top.willful_count > 0) return 'osha_willful_citation';
  if (top.repeat_count > 0) return 'osha_repeat_citation';
  if (top.serious_count > 0) return 'osha_serious_citation';
  if (top.inspection_count > 0) return 'osha_inspection_no_violation';
  return 'osha_violations_clean';
}

function summaryFor(legalName: string, top: OshaLookupRow | null): string {
  if (!top) {
    return `OSHA: no establishment match for "${legalName}" in 5-year construction-NAICS scope`;
  }
  const violations = top.serious_count + top.willful_count + top.repeat_count + top.other_count;
  if (violations === 0) {
    return `OSHA: ${top.inspection_count} inspection${top.inspection_count === 1 ? '' : 's'} on file for "${top.name_match}" — no citations`;
  }
  const parts: string[] = [];
  if (top.willful_count > 0) parts.push(`${top.willful_count} willful`);
  if (top.repeat_count > 0) parts.push(`${top.repeat_count} repeat`);
  if (top.serious_count > 0) parts.push(`${top.serious_count} serious`);
  if (top.other_count > 0) parts.push(`${top.other_count} other`);
  return `OSHA: ${violations} citation${violations === 1 ? '' : 's'} (${parts.join(', ')}) across ${top.inspection_count} inspection${top.inspection_count === 1 ? '' : 's'} for "${top.name_match}"`;
}

export async function scrapeOshaEstSearch(input: OshaEstSearchInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) throw new Error('scrapeOshaEstSearch: legalName required');

  const admin = createAdminClient();
  const start = Date.now();

  const { data, error } = await admin.rpc('osha_lookup_findings', {
    p_name_norm: legalName.toLowerCase(),
    p_state: input.stateCode ?? null,
    p_lookback_years: input.lookbackYears ?? 5,
  });

  const duration_ms = Date.now() - start;

  if (error) {
    throw new Error(`scrapeOshaEstSearch: osha_lookup_findings RPC failed: ${error.message}`);
  }

  const rows = (data ?? []) as OshaLookupRow[];

  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'osha_violations_clean',
      confidence: CONFIDENCE,
      finding_summary: summaryFor(legalName, null),
      extracted_facts: {
        query_name: legalName,
        state_code: input.stateCode ?? null,
        lookback_years: input.lookbackYears ?? 5,
        match_count: 0,
        violation_count: 0,
        serious_count: 0,
        citation_url: 'https://www.osha.gov/pls/imis/establishment.html',
      },
      query_sent: `osha_lookup_findings('${legalName.toLowerCase()}', '${input.stateCode ?? ''}', ${input.lookbackYears ?? 5})`,
      response_sha256: null,
      response_snippet: null,
      duration_ms,
      cost_cents: 0,
    };
  }

  const top = rows[0];
  const findingType = selectFindingType(top);
  const totalViolations = top.serious_count + top.willful_count + top.repeat_count + top.other_count;
  const mostRecentActivityNr = (top.activity_nrs && top.activity_nrs.length > 0)
    ? top.activity_nrs[0]
    : null;
  const citationUrl = inspectionCitationUrl(mostRecentActivityNr)
    ?? 'https://www.osha.gov/pls/imis/establishment.html';

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: CONFIDENCE,
    finding_summary: summaryFor(legalName, top),
    extracted_facts: {
      query_name: legalName,
      state_code: input.stateCode ?? null,
      lookback_years: input.lookbackYears ?? 5,
      match_count: rows.length,
      matched_name: top.name_match,
      match_similarity: top.match_similarity,
      establishment_id: top.estab_id,
      inspection_count: top.inspection_count,
      violation_count: totalViolations,
      serious_count: top.serious_count,
      willful_count: top.willful_count,
      repeat_count: top.repeat_count,
      other_count: top.other_count,
      total_current_penalty_usd: top.total_current_penalty,
      last_inspection_date: top.most_recent_date,
      most_severe_type: top.most_severe_type,
      activity_nrs: top.activity_nrs ?? [],
      citation_ids: top.citation_ids ?? [],
      citation_url: citationUrl,
    },
    query_sent: `osha_lookup_findings('${legalName.toLowerCase()}', '${input.stateCode ?? ''}', ${input.lookbackYears ?? 5})`,
    response_sha256: null,
    response_snippet: null,
    duration_ms,
    cost_cents: 0,
  };
}
