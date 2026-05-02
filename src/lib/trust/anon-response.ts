/**
 * Pure transform: trust_reports row → public-safe API response.
 * Excludes internal fields (raw_report, api_cost_usd, processing_ms,
 * report_summary_embedding, contractor_id, user_id).
 *
 * Used by /api/trust/lookup/anon (cached path).
 */

export type TrustReportRow = {
  id: string;
  contractor_name: string;
  city: string;
  state_code: string;
  tier: string;
  trust_score: number | null;
  risk_level: string | null;
  confidence_level: string;
  biz_status: string | null;
  biz_entity_type: string | null;
  biz_formation_date: string | null;
  lic_status: string | null;
  lic_license_number: string | null;
  bbb_rating: string | null;
  bbb_accredited: boolean | null;
  bbb_complaint_count: number | null;
  review_avg_rating: string | number | null;
  review_total: number | null;
  review_sentiment: string | null;
  legal_status: string | null;
  legal_findings: string[] | null;
  osha_status: string | null;
  osha_violation_count: number | null;
  osha_serious_count: number | null;
  red_flags: string[] | null;
  positive_indicators: string[] | null;
  summary: string | null;
  data_sources_searched: string[] | null;
  data_integrity_status: string;
  synthesis_model: string | null;
  created_at: string | null;
  // Internal — must NOT be in response:
  raw_report?: unknown;
  api_cost_usd?: unknown;
  processing_ms?: unknown;
  report_summary_embedding?: unknown;
  contractor_id?: unknown;
  user_id?: unknown;
};

export type PublicAnonReport = {
  id: string;
  contractor_name: string;
  city: string;
  state_code: string;
  tier: string;
  trust_score: number | null;
  risk_level: string | null;
  confidence_level: string;
  biz_status: string | null;
  biz_entity_type: string | null;
  biz_formation_date: string | null;
  lic_status: string | null;
  lic_license_number: string | null;
  bbb_rating: string | null;
  bbb_accredited: boolean | null;
  bbb_complaint_count: number | null;
  review_avg_rating: number | null;
  review_total: number | null;
  review_sentiment: string | null;
  legal_status: string | null;
  legal_findings: string[];
  osha_status: string | null;
  osha_violation_count: number | null;
  osha_serious_count: number | null;
  red_flags: string[];
  positive_indicators: string[];
  summary: string | null;
  data_sources_searched: string[];
  data_integrity_status: string;
  synthesis_model: string | null;
  created_at: string | null;
};

export function toPublicAnonReport(row: TrustReportRow): PublicAnonReport {
  return {
    id: row.id,
    contractor_name: row.contractor_name,
    city: row.city,
    state_code: String(row.state_code).trim(),
    tier: row.tier,
    trust_score: row.trust_score,
    risk_level: row.risk_level,
    confidence_level: row.confidence_level,
    biz_status: row.biz_status,
    biz_entity_type: row.biz_entity_type,
    biz_formation_date: row.biz_formation_date,
    lic_status: row.lic_status,
    lic_license_number: row.lic_license_number,
    bbb_rating: row.bbb_rating,
    bbb_accredited: row.bbb_accredited,
    bbb_complaint_count: row.bbb_complaint_count,
    review_avg_rating: row.review_avg_rating == null ? null : Number(row.review_avg_rating),
    review_total: row.review_total,
    review_sentiment: row.review_sentiment,
    legal_status: row.legal_status,
    legal_findings: row.legal_findings ?? [],
    osha_status: row.osha_status,
    osha_violation_count: row.osha_violation_count,
    osha_serious_count: row.osha_serious_count,
    red_flags: row.red_flags ?? [],
    positive_indicators: row.positive_indicators ?? [],
    summary: row.summary,
    data_sources_searched: row.data_sources_searched ?? [],
    data_integrity_status: row.data_integrity_status,
    synthesis_model: row.synthesis_model,
    created_at: row.created_at,
  };
}
