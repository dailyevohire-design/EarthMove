/**
 * Shared types for Tranche B scrapers.
 *
 * Every scraper returns a ScraperEvidence (or throws a typed error).
 * persist-evidence.ts is the single chokepoint that writes these to DB.
 * This separation lets us unit-test scrapers without DB and test persistence
 * without HTTP mocks.
 */

// Subset of trust_evidence.finding_type CHECK enum we expect Tranche B to emit.
// Full list in DB; restrict here to prevent typos.
export type TrustFindingType =
  | 'license_active' | 'license_inactive' | 'license_expired'
  | 'license_suspended' | 'license_not_found'
  | 'business_active' | 'business_inactive' | 'business_dissolved' | 'business_not_found'
  | 'osha_violation' | 'osha_serious_violation' | 'osha_no_violations'
  | 'legal_action_found' | 'legal_judgment_against' | 'legal_no_actions'
  | 'sanction_hit' | 'sanction_clear'
  | 'source_error' | 'source_not_applicable';

export type TrustConfidence =
  | 'verified_structured'
  | 'high_llm'
  | 'medium_llm'
  | 'low_inference'
  | 'contradicted';

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
