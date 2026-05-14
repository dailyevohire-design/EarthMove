import { describe, expect, it } from 'vitest';
import {
  buildFreeTierSynthesis,
  buildUserPrompt,
  validateSynthesis,
  type EvidenceItem,
  type PhoenixSignal,
  type ScoreContext,
} from '../synthesize-v2-prompt';

const baseScore: ScoreContext = {
  composite_score: 78,
  grade: 'B',
  risk_level: 'medium',
  phoenix_score: 100,
  evidence_count: 5,
  structured_hit_rate: 0.6,
  sanction_hit: false,
  license_suspended: false,
  legal_score: 85,
  business_entity_score: 90,
  license_score: 80,
  bbb_score: 70,
  osha_score: 75,
};

const ev = (id: string): EvidenceItem => ({
  id,
  source_key: 'sos_co',
  finding_type: 'registration',
  confidence: 'high',
  finding_summary: 'Entity in good standing',
});

const baseEvidence: EvidenceItem[] = [ev('e1'), ev('e2'), ev('e3'), ev('e4'), ev('e5')];

const baseValid = {
  summary: 'Entity registered and active across multiple sources.',
  red_flags: [],
  positives: [{ text: 'Entity in good standing.', evidence_ids: ['e1'] }],
  confidence: 'MEDIUM',
  phoenix_pattern_assessment: 'No phoenix-company indicators detected.',
};

describe('validateSynthesis', () => {
  it('passes a well-formed synthesis', () => {
    const result = validateSynthesis(baseValid, baseEvidence, baseScore);
    expect(result.ok).toBe(true);
  });

  it('fails when red_flag has no evidence_ids', () => {
    const r = validateSynthesis(
      { ...baseValid, red_flags: [{ text: 'concerning finding', evidence_ids: [] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('no evidence_ids'))).toBe(true);
  });

  it('fails when red_flag cites unknown evidence_id', () => {
    const r = validateSynthesis(
      { ...baseValid, red_flags: [{ text: 'concerning finding', evidence_ids: ['e99'] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('unknown evidence_id'))).toBe(true);
  });

  it('fails when positive has no evidence_ids', () => {
    const r = validateSynthesis(
      { ...baseValid, positives: [{ text: 'a positive', evidence_ids: [] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
  });

  it('fails when positive cites unknown evidence_id', () => {
    const r = validateSynthesis(
      { ...baseValid, positives: [{ text: 'a positive', evidence_ids: ['nope'] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
  });

  it('fails when summary contains forbidden vocab', () => {
    const r = validateSynthesis(
      { ...baseValid, summary: 'This contractor has committed fraud per records.' },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('fraud'))).toBe(true);
  });

  it('fails when red_flag.text contains forbidden vocab', () => {
    const r = validateSynthesis(
      { ...baseValid, red_flags: [{ text: 'criminal record', evidence_ids: ['e1'] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('criminal'))).toBe(true);
  });

  it('fails when positive.text contains forbidden vocab', () => {
    const r = validateSynthesis(
      { ...baseValid, positives: [{ text: 'not unsafe', evidence_ids: ['e1'] }] },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('unsafe'))).toBe(true);
  });

  it('fails when phoenix_pattern_assessment contains forbidden vocab', () => {
    const r = validateSynthesis(
      { ...baseValid, phoenix_pattern_assessment: 'Operations appear dishonest.' },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('dishonest'))).toBe(true);
  });

  it('forces confidence=LOW when evidence_count<3', () => {
    const lowScore = { ...baseScore, evidence_count: 2 };
    const lowEv = baseEvidence.slice(0, 2);
    const r = validateSynthesis(
      { ...baseValid, positives: [{ text: 'positive', evidence_ids: ['e1'] }], confidence: 'HIGH' },
      lowEv, lowScore,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.confidence).toBe('LOW');
  });

  it('forces confidence=LOW when structured_hit_rate<0.4', () => {
    const r = validateSynthesis(
      { ...baseValid, confidence: 'HIGH' },
      baseEvidence, { ...baseScore, structured_hit_rate: 0.3 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.confidence).toBe('LOW');
  });

  it('preserves confidence when both gates pass', () => {
    const r = validateSynthesis(
      { ...baseValid, confidence: 'HIGH' },
      baseEvidence, { ...baseScore, evidence_count: 10, structured_hit_rate: 0.8 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.confidence).toBe('HIGH');
  });

  it('requires phoenix mention when phoenix_score<80', () => {
    const r = validateSynthesis(
      { ...baseValid, phoenix_pattern_assessment: 'No concerning patterns detected.' },
      baseEvidence, { ...baseScore, phoenix_score: 5 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('phoenix'))).toBe(true);
  });

  it('accepts phoenix-aware assessment when phoenix_score<80', () => {
    const r = validateSynthesis(
      { ...baseValid, phoenix_pattern_assessment: 'Phoenix pattern indicators present per filings.' },
      baseEvidence, { ...baseScore, phoenix_score: 5 },
    );
    expect(r.ok).toBe(true);
  });

  it('reports multiple violations together', () => {
    const r = validateSynthesis(
      {
        summary: 'fraud detected',
        red_flags: [{ text: 'criminal acts', evidence_ids: ['unknown1'] }],
        positives: [{ text: 'safe', evidence_ids: [] }],
        confidence: 'HIGH',
        phoenix_pattern_assessment: 'illegal conduct',
      },
      baseEvidence, baseScore,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('buildFreeTierSynthesis', () => {
  it('builds correct summary for grade-A score', () => {
    const out = buildFreeTierSynthesis({ ...baseScore, composite_score: 92, grade: 'A', risk_level: 'low' });
    expect(out.summary).toContain('92/100');
    expect(out.summary).toContain('grade A');
    expect(out.summary).toContain('low risk');
  });

  it('flags sanction_hit', () => {
    const out = buildFreeTierSynthesis({ ...baseScore, sanction_hit: true });
    expect(out.red_flags.some((f) => f.text.toLowerCase().includes('sanction'))).toBe(true);
  });

  it('flags license_suspended ONLY when evidence-backed', () => {
    // Score signal alone is NOT enough — must also have backing evidence row.
    const noEvidence = buildFreeTierSynthesis({ ...baseScore, license_suspended: true });
    expect(noEvidence.red_flags.some((f) => f.text.toLowerCase().includes('suspended'))).toBe(false);

    const withEvidence = buildFreeTierSynthesis(
      { ...baseScore, license_suspended: true },
      { phoenix: false, license_suspended: true },
    );
    expect(withEvidence.red_flags.some((f) => f.text.toLowerCase().includes('suspended'))).toBe(true);
  });

  it('flags phoenix_score<80 ONLY when evidence-backed', () => {
    // Score signal alone is NOT enough — must also have backing evidence row.
    const noEvidence = buildFreeTierSynthesis({ ...baseScore, phoenix_score: 3 });
    expect(noEvidence.red_flags.some((f) => f.text.toLowerCase().includes('phoenix'))).toBe(false);

    const withEvidence = buildFreeTierSynthesis(
      { ...baseScore, phoenix_score: 3 },
      { phoenix: true, license_suspended: false },
    );
    expect(withEvidence.red_flags.some((f) => f.text.toLowerCase().includes('phoenix'))).toBe(true);
    expect(withEvidence.phoenix_pattern_assessment.toLowerCase()).toContain('phoenix');
  });

  it('lists clean legal record when legal_score>=80', () => {
    const out = buildFreeTierSynthesis({ ...baseScore, legal_score: 88 });
    expect(out.positives.some((p) => p.text.toLowerCase().includes('legal'))).toBe(true);
  });

  it('lists entity in good standing when business_entity_score>=80', () => {
    const out = buildFreeTierSynthesis({ ...baseScore, business_entity_score: 85 });
    expect(out.positives.some((p) => p.text.toLowerCase().includes('good standing'))).toBe(true);
  });

  it('handles zero evidence gracefully', () => {
    const out = buildFreeTierSynthesis({ ...baseScore, evidence_count: 0, structured_hit_rate: 0 });
    expect(out.summary).toContain('0 evidence finding');
    expect(out.confidence).toBe('LOW');
  });

  it('output contains no forbidden vocab', () => {
    const out = buildFreeTierSynthesis(
      {
        ...baseScore, sanction_hit: true, license_suspended: true, phoenix_score: 5,
        legal_score: 85, business_entity_score: 90, license_score: 85,
      },
      // Pass evidence-backed flags so license + phoenix red flags actually fire
      // and their text is part of the vocab-safety assertion.
      { phoenix: true, license_suspended: true },
    );
    const blob = [
      out.summary, out.phoenix_pattern_assessment,
      ...out.red_flags.map((r) => r.text), ...out.positives.map((p) => p.text),
    ].join(' ').toLowerCase();
    for (const word of ['fraud', 'scam', 'criminal', 'illegal', 'unsafe', 'dangerous', 'unreliable', 'dishonest']) {
      expect(blob).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });
});

describe('buildUserPrompt — PHOENIX_SIGNALS section (Tier 3 #1 commit 3)', () => {
  const baseArgs = {
    contractorName: 'Acme Construction LLC',
    city: 'Denver',
    stateCode: 'CO',
    score: baseScore,
    evidence: baseEvidence,
  };

  it('omits PHOENIX_SIGNALS section when phoenixSignals is undefined', () => {
    const out = buildUserPrompt(baseArgs);
    expect(out).not.toContain('PHOENIX_SIGNALS');
  });

  it('omits PHOENIX_SIGNALS section when phoenixSignals is empty', () => {
    const out = buildUserPrompt({ ...baseArgs, phoenixSignals: [] });
    expect(out).not.toContain('PHOENIX_SIGNALS');
  });

  it('officer signal with source_evidence_id renders as citable', () => {
    const signals: PhoenixSignal[] = [{
      signal: 'shared_officer_with_dissolved',
      weight: 0.5,
      evidence: {
        officer_id: 'officer-uuid-1',
        other_contractor_id: 'contractor-uuid-2',
        edge_id: 'edge-uuid-1',
        source_evidence_id: 'ev-uuid-99',
      },
    }];
    const out = buildUserPrompt({ ...baseArgs, phoenixSignals: signals });
    expect(out).toContain('PHOENIX_SIGNALS (1 signals)');
    expect(out).toContain('shared_officer_with_dissolved');
    expect(out).toContain('weight=0.5');
    expect(out).toContain('cite via evidence_id [ev-uuid-99]');
    expect(out).not.toContain('NARRATIVE ONLY');
  });

  it('officer signal without source_evidence_id renders as narrative-only', () => {
    const signals: PhoenixSignal[] = [{
      signal: 'shared_officer_with_active',
      weight: 0.25,
      evidence: {
        officer_id: 'officer-uuid-1',
        other_contractor_id: 'contractor-uuid-2',
        edge_id: 'edge-uuid-1',
        // no source_evidence_id (pre-migration-121 link, or NULL)
      },
    }];
    const out = buildUserPrompt({ ...baseArgs, phoenixSignals: signals });
    expect(out).toContain('shared_officer_with_active');
    expect(out).toContain('NARRATIVE ONLY (no source_evidence_id available)');
    expect(out).not.toContain('cite via evidence_id');
  });

  it('aggregate signals always render as narrative-only', () => {
    const signals: PhoenixSignal[] = [
      { signal: 'shared_phone', weight: 0.4, evidence: { match_count: 4 } },
      { signal: 'shared_ein', weight: 0.6, evidence: {} },
      { signal: 'address_shared_with_many', weight: 0.25, evidence: { other_contractor_count: 7 } },
    ];
    const out = buildUserPrompt({ ...baseArgs, phoenixSignals: signals });
    expect(out).toContain('PHOENIX_SIGNALS (3 signals)');
    expect(out).toContain('shared_phone');
    expect(out).toContain('shared_ein');
    expect(out).toContain('address_shared_with_many');
    // Three lines, each marked narrative-only
    const narrativeLines = (out.match(/NARRATIVE ONLY \(aggregate signal\)/g) ?? []);
    expect(narrativeLines).toHaveLength(3);
  });

  it('mixed signals render correctly together', () => {
    const signals: PhoenixSignal[] = [
      {
        signal: 'shared_officer_with_dissolved',
        weight: 0.5,
        evidence: { officer_id: 'o1', other_contractor_id: 'c2', edge_id: 'e1', source_evidence_id: 'ev1' },
      },
      { signal: 'shared_phone', weight: 0.4, evidence: { match_count: 3 } },
    ];
    const out = buildUserPrompt({ ...baseArgs, phoenixSignals: signals });
    expect(out).toContain('PHOENIX_SIGNALS (2 signals)');
    expect(out).toContain('cite via evidence_id [ev1]');
    expect(out).toContain('NARRATIVE ONLY (aggregate signal)');
  });
});
