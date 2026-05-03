import { describe, it, expect } from 'vitest';
import {
  computeSignals,
  emitFindings,
  emitFetchErrorFinding,
  normalizePermits,
  type PermitRecord,
} from '../permit-normalize';

const NOW = new Date('2026-05-02T12:00:00Z');

function mkPermit(overrides: Partial<PermitRecord> = {}, idx = 0): PermitRecord {
  return {
    permit_number: overrides.permit_number ?? `P-${idx}`,
    issued_date: overrides.issued_date ?? '2024-01-15',
    work_class: overrides.work_class ?? 'NEW BUILDING',
    address: overrides.address ?? '123 MAIN ST',
    status: overrides.status ?? '',
    contractor_name: overrides.contractor_name ?? 'TEST CONSTRUCTION',
  };
}

function permitsAcross(years: number[], workClass = 'ALTERATION'): PermitRecord[] {
  return years.map((monthsAgo, i) => {
    const d = new Date(NOW);
    d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    return mkPermit({
      permit_number: `P-${i}-${monthsAgo}`,
      issued_date: d.toISOString().slice(0, 10),
      work_class: workClass,
    }, i);
  });
}

describe('normalizePermits', () => {
  it('drops adapter-rejected rows', () => {
    const raw = [{ ok: true, n: 'A' }, { ok: false, n: 'B' }, { ok: true, n: 'C' }];
    const out = normalizePermits(raw, (r: { ok: boolean; n: string }) =>
      r.ok ? mkPermit({ permit_number: r.n }) : null,
    );
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.permit_number)).toEqual(['A', 'C']);
  });

  it('dedupes by permit_number, keeps first occurrence', () => {
    const out = normalizePermits(
      [{ n: 'A' }, { n: 'A' }, { n: 'B' }],
      (r: { n: string }) => mkPermit({ permit_number: r.n }),
    );
    expect(out.map((p) => p.permit_number)).toEqual(['A', 'B']);
  });
});

describe('computeSignals', () => {
  it('empty input → all zeros + null most_recent', () => {
    const s = computeSignals([], NOW);
    expect(s.total_permits).toBe(0);
    expect(s.permit_count_last_12mo).toBe(0);
    expect(s.permits_5y).toBe(0);
    expect(s.most_recent_permit_date).toBeNull();
    expect(s.work_class_distribution).toEqual({});
  });

  it('25 permits across 4 years, most recent 2mo ago', () => {
    // Build 25 permits: one every ~2 months over 50 months
    const permits: PermitRecord[] = [];
    for (let i = 0; i < 25; i++) {
      const d = new Date(NOW);
      d.setUTCMonth(d.getUTCMonth() - (2 + i * 2));
      permits.push(mkPermit({
        permit_number: `P-${i}`,
        issued_date: d.toISOString().slice(0, 10),
        work_class: i % 3 === 0 ? 'NEW BUILDING' : 'ALTERATION',
      }, i));
    }
    const s = computeSignals(permits, NOW);
    expect(s.total_permits).toBe(25);
    expect(s.permits_5y).toBe(25);
    expect(s.permit_count_last_12mo).toBeGreaterThanOrEqual(5);
    expect(s.permit_count_last_12mo).toBeLessThanOrEqual(7);
    expect(s.most_recent_permit_date).toMatch(/^2026-03-/);
    expect(Object.keys(s.work_class_distribution)).toEqual(
      expect.arrayContaining(['NEW BUILDING', 'ALTERATION']),
    );
  });

  it('groups identical work classes correctly', () => {
    const s = computeSignals(permitsAcross([1, 2, 3], 'PLUMBING'), NOW);
    expect(s.work_class_distribution).toEqual({ PLUMBING: 3 });
  });
});

describe('emitFindings', () => {
  const ctx = {
    source_key: 'denver_pim',
    jurisdiction: 'denver',
    contractor_name: 'PCL CONSTRUCTION',
    asOf: NOW,
  };

  it('25 permits + 2mo recent → robust + clean (2 findings)', () => {
    const permits: PermitRecord[] = [];
    for (let i = 0; i < 25; i++) {
      const d = new Date(NOW);
      d.setUTCMonth(d.getUTCMonth() - (2 + i * 2));
      permits.push(mkPermit({ permit_number: `P-${i}`, issued_date: d.toISOString().slice(0, 10) }, i));
    }
    const signals = computeSignals(permits, NOW);
    const findings = emitFindings(permits, signals, ctx);
    const types = findings.map((f) => f.finding_type);
    expect(types).toContain('permit_history_clean');
    expect(types).toContain('permit_history_robust');
    expect(types).not.toContain('permit_history_low');
    expect(types).not.toContain('permit_history_stale');
    expect(findings).toHaveLength(2);
  });

  it('3 permits across 5yr, most recent 2yr ago → low + stale + clean (3 findings)', () => {
    const permits = permitsAcross([24, 36, 48]);
    const signals = computeSignals(permits, NOW);
    const findings = emitFindings(permits, signals, ctx);
    const types = findings.map((f) => f.finding_type);
    expect(types).toContain('permit_history_clean');
    expect(types).toContain('permit_history_low');
    expect(types).toContain('permit_history_stale');
    expect(types).not.toContain('permit_history_robust');
    expect(findings).toHaveLength(3);
  });

  it('zero permits → only clean informational, no flags', () => {
    const findings = emitFindings([], computeSignals([], NOW), ctx);
    expect(findings).toHaveLength(2); // clean + low (zero is < 5 threshold)
    expect(findings.map((f) => f.finding_type)).toEqual(
      expect.arrayContaining(['permit_history_clean', 'permit_history_low']),
    );
  });

  it('clean informational always has counts in extracted_facts + canonical sha', () => {
    const permits = permitsAcross([1, 2, 3]);
    const findings = emitFindings(permits, computeSignals(permits, NOW), ctx);
    const clean = findings.find((f) => f.finding_type === 'permit_history_clean');
    expect(clean).toBeDefined();
    expect(clean!.extracted_facts.permits_5y).toBe(3);
    expect(clean!.extracted_facts.total_permits).toBe(3);
    expect(clean!.extracted_facts.most_recent_permit_date).toMatch(/^2026-/);
    expect(clean!.extracted_facts.address_match_count).toBe(1);
    expect(clean!.extracted_facts.jurisdiction).toBe('denver');
    expect(clean!.response_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('address_match_count counts distinct uppercased addresses (denver-style aggregation)', () => {
    const permits: PermitRecord[] = [
      mkPermit({ permit_number: 'A', address: '123 Main St' }, 0),
      mkPermit({ permit_number: 'B', address: '123 MAIN ST' }, 1),
      mkPermit({ permit_number: 'C', address: '456 Oak Ave' }, 2),
      mkPermit({ permit_number: 'D', address: '' }, 3),
    ];
    const findings = emitFindings(permits, computeSignals(permits, NOW), ctx);
    const clean = findings.find((f) => f.finding_type === 'permit_history_clean')!;
    expect(clean.extracted_facts.address_match_count).toBe(2);
  });

  it('15 permits all 3yr+ ago → stale + clean (no robust, no low)', () => {
    const permits = permitsAcross([36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 36, 38, 40]);
    const signals = computeSignals(permits, NOW);
    const findings = emitFindings(permits, signals, ctx);
    const types = findings.map((f) => f.finding_type);
    expect(types).toContain('permit_history_clean');
    expect(types).toContain('permit_history_stale');
    expect(types).not.toContain('permit_history_robust');
    expect(types).not.toContain('permit_history_low');
  });
});

describe('emitFetchErrorFinding', () => {
  it('returns single unverified informational row', () => {
    const f = emitFetchErrorFinding({
      source_key: 'dallas_open_data',
      jurisdiction: 'dallas',
      contractor_name: 'Acme Construction',
      error: new Error('ECONNREFUSED'),
    });
    expect(f.finding_type).toBe('permit_history_clean');
    expect(f.confidence).toBe('unverified');
    expect(f.finding_summary).toContain('portal unreachable');
    expect(f.extracted_facts.error_message).toContain('ECONNREFUSED');
    expect(f.extracted_facts.error_class).toBe('Error');
  });
});
