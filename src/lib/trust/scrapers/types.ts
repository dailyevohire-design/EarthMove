/**
 * Shared types for Tranche B scrapers.
 *
 * Every scraper returns a ScraperEvidence (or throws a typed error).
 * persist-evidence.ts is the single chokepoint that writes these to DB.
 * This separation lets us unit-test scrapers without DB and test persistence
 * without HTTP mocks.
 */

// Subset of trust_evidence.finding_type values scrapers emit. The DB CHECK
// constraint (migration 201) enforces these at write time; this TS union
// mirrors it and prevents typos at the scraper layer.
export type TrustFindingType =
  // license-board (extended in migration 201)
  | 'license_active' | 'license_inactive' | 'license_expired'
  | 'license_suspended' | 'license_revoked' | 'license_not_found'
  | 'license_disciplinary_action' | 'license_penalty_assessed'
  | 'license_no_record' | 'license_revoked_but_operating'
  // business entity
  | 'business_active' | 'business_inactive' | 'business_dissolved' | 'business_not_found'
  // OSHA (legacy + finer-grained from migration 201)
  | 'osha_violation' | 'osha_serious_violation' | 'osha_no_violations'
  | 'osha_violations_clean' | 'osha_serious_citation' | 'osha_willful_citation'
  | 'osha_repeat_citation' | 'osha_fatality_finding' | 'osha_inspection_no_violation'
  // legal / civil court
  | 'legal_action_found' | 'legal_judgment_against' | 'legal_no_actions'
  | 'civil_judgment_against' | 'civil_settlement' | 'civil_no_judgments'
  | 'mechanic_lien_filed' | 'mechanic_lien_resolved'
  // federal sanctions / contractor
  | 'sanction_hit' | 'sanction_clear'
  | 'federal_contractor_active' | 'federal_contractor_past_performance'
  | 'federal_contractor_no_record'
  // insurance (migration 201)
  | 'insurance_active_gl' | 'insurance_active_wc' | 'insurance_lapsed'
  | 'insurance_no_record' | 'insurance_below_minimum' | 'insurance_carrier_name'
  // BBB
  | 'bbb_accredited' | 'bbb_rating' | 'bbb_complaint' | 'bbb_not_profiled'
  | 'bbb_rating_a_plus' | 'bbb_rating_a' | 'bbb_rating_b'
  | 'bbb_rating_c_or_below' | 'bbb_complaints_high' | 'bbb_no_profile'
  // permits
  | 'permit_history_robust' | 'permit_history_clean'
  | 'permit_history_low' | 'permit_history_stale' | 'permit_scope_violation'
  // operational
  | 'source_error' | 'source_not_applicable'
  // 227: entity disambiguation
  | 'entity_disambiguation_candidates' | 'name_discrepancy_observed';

/**
 * Single registry-entity row surfaced by an entity-registry scraper's
 * candidate-search method. Ranked + filtered by name-similarity in the
 * orchestrator before being persisted in extracted_facts.candidates.
 *
 * Powers the 'Did you mean...?' disambiguation card (PR #27 commit 3).
 */
export interface EntityCandidate {
  entity_id: string;
  entity_name: string;
  entity_type: string | null;
  status: string | null;
  formation_date: string | null;
  principal_address: string | null;
  registered_agent: string | null;
  source_key: string;
  source_url: string | null;
  /** Populated by rankCandidates() — never read from upstream registry. */
  similarity_score: number;
}

export type TrustConfidence =
  | 'verified_structured'
  | 'high_llm'
  | 'medium_llm'
  | 'low_inference'
  | 'contradicted'
  | 'unverified';

export interface ScraperEvidence {
  source_key: string;
  finding_type: TrustFindingType;
  confidence: TrustConfidence;
  finding_summary: string;
  extracted_facts: Record<string, unknown>;
  query_sent: string | null;
  response_sha256: string | null;
  response_snippet: string | null;
  duration_ms: number;
  cost_cents: number;
}

/**
 * Multi-finding scrapers (e.g. permit history aggregating across layers)
 * return an array; single-finding scrapers return one ScraperEvidence.
 * runScraper normalizes both shapes to ScraperEvidence[].
 */
export type ScraperResult = ScraperEvidence | ScraperEvidence[];

export class ScraperError extends Error {
  constructor(message: string, public readonly source_key: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class ScraperAuthError extends ScraperError {}
export class ScraperRateLimitError extends ScraperError {
  constructor(message: string, source_key: string, public readonly retryAfterSec: number | null) {
    super(message, source_key);
  }
}
export class ScraperUpstreamError extends ScraperError {
  constructor(message: string, source_key: string, public readonly status: number) {
    super(message, source_key);
  }
}
export class ScraperTimeoutError extends ScraperError {}
