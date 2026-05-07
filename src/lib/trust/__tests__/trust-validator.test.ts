import { describe, expect, it } from 'vitest';
import { parseReport } from '../trust-validator';

// Minimal valid report payload — every required field of TrustReportSchema.
// Built once and reused across cases to keep tests focused on parser behavior,
// not schema mechanics. If the schema gains required fields this fixture will
// fail loudly and all tests below need updating in one place.
const validReportObject = {
  trust_score: 50,
  risk_level: 'MEDIUM',
  confidence_level: 'LOW',
  business_registration: { status: 'unknown' },
  licensing: { status: 'unknown' },
  bbb_profile: { rating: null, accredited: null, complaint_count: null },
  reviews: { average_rating: null, total_reviews: null, sentiment: 'INSUFFICIENT_DATA', sources: [] },
  legal_records: { status: 'INSUFFICIENT_DATA' },
  osha_violations: { status: 'INSUFFICIENT_DATA' },
  red_flags: [],
  positive_indicators: [],
  summary: 'Insufficient data to verify the contractor.',
  data_sources_searched: [],
};

const validReportJson = JSON.stringify(validReportObject);

describe('parseReport — robust to LLM trailing junk', () => {
  it('parses plain JSON', () => {
    const r = parseReport(validReportJson);
    expect(r.ok).toBe(true);
  });

  it('parses JSON followed by trailing prose (the live failure case)', () => {
    // Repro of the production bug: model emits valid JSON, then appends a
    // closing thought despite the system prompt forbidding it. The old
    // slice-to-last-} approach caught the trailing text and JSON.parse threw
    // "Unexpected non-whitespace character after JSON at position N".
    const raw = `${validReportJson}\n\nNote: the contractor was not found in any public registry.`;
    const r = parseReport(raw);
    expect(r.ok).toBe(true);
  });

  it('parses JSON wrapped in markdown fences', () => {
    const r = parseReport('```json\n' + validReportJson + '\n```');
    expect(r.ok).toBe(true);
  });

  it('parses JSON with strings containing braces (does not get confused by content)', () => {
    const obj = { ...validReportObject, summary: 'Contractor address: { suite 200 }, plus details.' };
    const r = parseReport(JSON.stringify(obj));
    expect(r.ok).toBe(true);
  });

  it('returns ok:false for empty / no-JSON input', () => {
    const r = parseReport('the model returned no json at all');
    expect(r.ok).toBe(false);
  });
});
