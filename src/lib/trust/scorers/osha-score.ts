/**
 * src/lib/trust/scorers/osha-score.ts
 *
 * OSHA component of the trust score. Calls osha_lookup_findings() against the
 * locally-mirrored OSHA tables — no external HTTP at score time.
 *
 * Severity hierarchy (most → least): W (Willful) > R (Repeat) > S (Serious) > O/U (Other).
 *
 *   No establishment match            → null score, source_not_applicable (skip)
 *   Match, no violations in lookback  → 95, osha_violations_clean
 *   Most-severe = O/U only            → 75, osha_inspection_no_violation
 *   Most-severe = S                   → 35, osha_serious_citation
 *   Most-severe = R                   → 15, osha_repeat_citation
 *   Most-severe = W                   →  5, osha_willful_citation
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const SOURCE_KEY = 'osha_est_search';
const LOOKBACK_YEARS = 5;

const LEGAL_SUFFIX_RE = /\b(l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|lp|llp|pllc|pc)\b/g;
function normalizeName(raw: string): string {
  return (raw ?? '').toLowerCase()
    .replace(/[.,'"`]/g, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type OshaScoreInput = {
  contractorId: string;
  jobId: string;
  contractorName: string;
  state?: string | null;
};

export type OshaScoreFinding = {
  finding_type: string;
  confidence: 'verified_structured' | 'high_llm' | 'medium_llm' | 'low_inference' | 'contradicted' | 'unverified';
  evidence_payload: Record<string, unknown>;
  citation_url: string | null;
};

export type OshaScoreResult = {
  score: number | null;
  findings: OshaScoreFinding[];
  diagnostic: { matched: boolean; estab_id?: string; match_similarity?: number };
};

type LookupRow = {
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
  most_severe_type: 'W' | 'R' | 'S' | 'O' | null;
  activity_nrs: string[] | null;
  citation_ids: string[] | null;
};

export async function runOshaScorer(
  sb: SupabaseClient,
  input: OshaScoreInput,
): Promise<OshaScoreResult> {
  const nameNorm = normalizeName(input.contractorName);
  if (!nameNorm) {
    return { score: null, findings: [], diagnostic: { matched: false } };
  }

  const { data, error } = await sb.rpc('osha_lookup_findings', {
    p_name_norm: nameNorm,
    p_state: input.state ?? null,
    p_lookback_years: LOOKBACK_YEARS,
  });

  if (error) {
    return {
      score: null,
      findings: [{
        finding_type: 'source_error',
        confidence: 'unverified',
        evidence_payload: { source_key: SOURCE_KEY, error: error.message, name_norm: nameNorm },
        citation_url: null,
      }],
      diagnostic: { matched: false },
    };
  }

  const rows = (data ?? []) as LookupRow[];
  if (rows.length === 0) {
    return {
      score: null,
      findings: [{
        finding_type: 'source_not_applicable',
        confidence: 'verified_structured',
        evidence_payload: {
          source_key: SOURCE_KEY,
          reason: 'no_establishment_match',
          name_norm: nameNorm,
          state: input.state ?? null,
          lookback_years: LOOKBACK_YEARS,
        },
        citation_url: null,
      }],
      diagnostic: { matched: false },
    };
  }

  const top = rows[0];
  const citationUrl = `https://www.osha.gov/ords/imis/establishment.search?establishment=${encodeURIComponent(input.contractorName)}&Office=All`;

  if (top.inspection_count > 0 && top.most_severe_type === null) {
    return {
      score: 95,
      findings: [{
        finding_type: 'osha_violations_clean',
        confidence: 'verified_structured',
        evidence_payload: {
          source_key: SOURCE_KEY,
          estab_id: top.estab_id,
          name_match: top.name_match,
          match_similarity: top.match_similarity,
          inspection_count: top.inspection_count,
          most_recent_inspection: top.most_recent_date,
          activity_nrs: top.activity_nrs,
          lookback_years: LOOKBACK_YEARS,
        },
        citation_url: citationUrl,
      }],
      diagnostic: { matched: true, estab_id: top.estab_id, match_similarity: top.match_similarity },
    };
  }

  const SEV_MAP: Record<'W'|'R'|'S'|'O', { score: number; finding: string }> = {
    W: { score: 5,  finding: 'osha_willful_citation' },
    R: { score: 15, finding: 'osha_repeat_citation' },
    S: { score: 35, finding: 'osha_serious_citation' },
    O: { score: 75, finding: 'osha_inspection_no_violation' },
  };
  const sev = top.most_severe_type ?? 'O';
  const { score, finding } = SEV_MAP[sev];

  return {
    score,
    findings: [{
      finding_type: finding,
      confidence: 'verified_structured',
      evidence_payload: {
        source_key: SOURCE_KEY,
        estab_id: top.estab_id,
        name_match: top.name_match,
        match_similarity: top.match_similarity,
        inspection_count: top.inspection_count,
        willful_count: top.willful_count,
        repeat_count: top.repeat_count,
        serious_count: top.serious_count,
        other_count: top.other_count,
        total_current_penalty: top.total_current_penalty,
        most_recent_inspection: top.most_recent_date,
        most_severe_type: top.most_severe_type,
        activity_nrs: top.activity_nrs,
        citation_ids: top.citation_ids,
        lookback_years: LOOKBACK_YEARS,
      },
      citation_url: citationUrl,
    }],
    diagnostic: { matched: true, estab_id: top.estab_id, match_similarity: top.match_similarity },
  };
}
