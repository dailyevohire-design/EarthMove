import { describe, it, expect } from 'vitest';
import { normalizeBusinessName } from '../business-name';

// Corpus locked from production SQL function public.normalize_contractor_name()
// captured 2026-04-30 via Supabase MCP. If SQL changes, this test fails until
// TS port is updated to match.
const CORPUS: ReadonlyArray<readonly [input: string, expected: string]> = [
  ['ACME PLUMBING LLC', 'acme plumbing'],
  ['Acme Plumbing, LLC', 'acme plumbing'],
  ['Acme Plumbing L.L.C.', 'acme plumbing l.l.c.'],
  ['  Acme   Plumbing  LLC  ', 'acme plumbing'],
  ['Acme Plumbing Inc.', 'acme plumbing'],
  ['Acme Plumbing INC', 'acme plumbing'],
  ['Acme Plumbing, Inc.', 'acme plumbing'],
  ['Acme Plumbing Incorporated', 'acme plumbing'],
  ['Acme Plumbing Corp', 'acme plumbing'],
  ['Acme Plumbing Corp.', 'acme plumbing'],
  ['Acme Plumbing Corporation', 'acme plumbing'],
  ['Acme Plumbing Ltd', 'acme plumbing'],
  ['Acme Plumbing Limited', 'acme plumbing'],
  ['Acme Plumbing LP', 'acme plumbing'],
  ['Acme Plumbing LLP', 'acme plumbing'],
  ['Acme Plumbing PLLC', 'acme plumbing'],
  ['Acme Plumbing PA', 'acme plumbing'],
  ['Acme Plumbing PC', 'acme plumbing'],
  ['Acme Plumbing Company', 'acme plumbing'],
  ['Acme Plumbing Co', 'acme plumbing'],
  ['Acme Plumbing Co.', 'acme plumbing'],
  ['The Acme Plumbing Company', 'the acme plumbing'],
  ['Acme & Sons Plumbing LLC', 'acme & sons plumbing'],
  ['Café Müller, LLC', 'café müller'],
  ['Acme Plumbing', 'acme plumbing'],
  ['', ''],
  ['LLC', 'llc'],
  ['Acme Plumbing LLC INC', 'acme plumbing llc'],
  ['Brannan Sand and Gravel Company', 'brannan sand and gravel'],
  ['PCL Construction Services Inc.', 'pcl construction services'],
  ['Saunders Construction LLC', 'saunders construction'],
  ['earth pro connect llc', 'earth pro connect'],
];

describe('normalizeBusinessName — SQL parity corpus', () => {
  it.each(CORPUS)('normalizes %j -> %j', (input, expected) => {
    expect(normalizeBusinessName(input)).toBe(expected);
  });

  it('handles null/undefined defensively', () => {
    expect(normalizeBusinessName(null as any)).toBe('');
    expect(normalizeBusinessName(undefined as any)).toBe('');
  });

});
