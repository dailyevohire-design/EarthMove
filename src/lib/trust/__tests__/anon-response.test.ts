import { describe, expect, it } from 'vitest';
import { toPublicAnonReport, type TrustReportRow } from '../anon-response';

const baseRow: TrustReportRow = {
  id: 'rep-uuid',
  contractor_name: 'Test Contractor',
  city: 'Denver',
  state_code: 'CO',
  tier: 'free',
  trust_score: 87,
  risk_level: 'LOW',
  confidence_level: 'MEDIUM',
  biz_status: 'active',
  biz_entity_type: 'LLC',
  biz_formation_date: '2010-01-15',
  lic_status: 'active',
  lic_license_number: 'GC-123',
  bbb_rating: 'A+',
  bbb_accredited: true,
  bbb_complaint_count: 0,
  review_avg_rating: '4.6',
  review_total: 87,
  review_sentiment: 'positive',
  legal_status: 'clean',
  legal_findings: [],
  osha_status: 'no_violations',
  osha_violation_count: 0,
  osha_serious_count: 0,
  red_flags: [],
  positive_indicators: ['Active license'],
  summary: 'Clean record',
  data_sources_searched: ['co_sos_biz', 'denver_cpd'],
  data_integrity_status: 'ok',
  synthesis_model: 'free_tier_templated',
  created_at: '2026-05-02T10:00:00Z',
};

describe('toPublicAnonReport', () => {
  it('passes through public fields', () => {
    const r = toPublicAnonReport(baseRow);
    expect(r.id).toBe('rep-uuid');
    expect(r.contractor_name).toBe('Test Contractor');
    expect(r.trust_score).toBe(87);
    expect(r.summary).toBe('Clean record');
  });

  it('coerces review_avg_rating from numeric-string to number', () => {
    const r = toPublicAnonReport({ ...baseRow, review_avg_rating: '4.6' });
    expect(r.review_avg_rating).toBe(4.6);
    expect(typeof r.review_avg_rating).toBe('number');
  });

  it('preserves null for review_avg_rating when null', () => {
    const r = toPublicAnonReport({ ...baseRow, review_avg_rating: null });
    expect(r.review_avg_rating).toBeNull();
  });

  it('substitutes empty array for null array fields', () => {
    const r = toPublicAnonReport({
      ...baseRow,
      red_flags: null,
      positive_indicators: null,
      legal_findings: null,
      data_sources_searched: null,
    });
    expect(r.red_flags).toEqual([]);
    expect(r.positive_indicators).toEqual([]);
    expect(r.legal_findings).toEqual([]);
    expect(r.data_sources_searched).toEqual([]);
  });

  it('trims state_code (DB stores as char(2) padded)', () => {
    const r = toPublicAnonReport({ ...baseRow, state_code: 'CO ' as string });
    expect(r.state_code).toBe('CO');
    expect(r.state_code.length).toBe(2);
  });

  it('omits internal fields even if present on input', () => {
    const rowWithSecrets = {
      ...baseRow,
      raw_report: { secret: 'data' },
      api_cost_usd: 0.19,
      processing_ms: 12345,
      report_summary_embedding: [0.1, 0.2],
      contractor_id: 'internal-uuid',
      user_id: 'user-uuid',
    } as TrustReportRow;
    const r = toPublicAnonReport(rowWithSecrets);
    expect(r).not.toHaveProperty('raw_report');
    expect(r).not.toHaveProperty('api_cost_usd');
    expect(r).not.toHaveProperty('processing_ms');
    expect(r).not.toHaveProperty('report_summary_embedding');
    expect(r).not.toHaveProperty('contractor_id');
    expect(r).not.toHaveProperty('user_id');
  });

  it('keeps response shape stable across all-null optional fields', () => {
    const r = toPublicAnonReport({
      ...baseRow,
      trust_score: null,
      risk_level: null,
      biz_status: null,
      lic_status: null,
      bbb_rating: null,
      bbb_accredited: null,
      bbb_complaint_count: null,
      review_avg_rating: null,
      review_total: null,
      review_sentiment: null,
      legal_status: null,
      osha_status: null,
      summary: null,
      synthesis_model: null,
      created_at: null,
    });
    expect(r.trust_score).toBeNull();
    expect(r.summary).toBeNull();
    expect(r.id).toBe('rep-uuid');
  });
});
