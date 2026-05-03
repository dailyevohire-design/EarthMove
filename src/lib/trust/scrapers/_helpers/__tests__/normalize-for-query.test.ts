import { describe, it, expect } from 'vitest';
import { normalizeForExternalQuery } from '../normalize-for-query';

describe('normalizeForExternalQuery', () => {
  // Entity-form suffix stripping — the FOLLOWUP-CROSS-SOURCE-NAME-NORM fix
  it('strips comma-Inc.', () => {
    expect(normalizeForExternalQuery('PCL Construction Services, Inc.'))
      .toBe('PCL Construction Services');
  });

  it('strips comma-INC. uppercase', () => {
    expect(normalizeForExternalQuery('PLAZA CONSTRUCTION, INC.'))
      .toBe('PLAZA CONSTRUCTION');
  });

  it('strips space-LLC (no comma)', () => {
    expect(normalizeForExternalQuery('Acme Builders LLC'))
      .toBe('Acme Builders');
  });

  it('strips comma-LLC', () => {
    expect(normalizeForExternalQuery('Acme Builders, LLC'))
      .toBe('Acme Builders');
  });

  it('strips space-Corp.', () => {
    expect(normalizeForExternalQuery('Acme Corp.'))
      .toBe('Acme');
  });

  it('strips space-Inc.', () => {
    expect(normalizeForExternalQuery('Concrete Inc.'))
      .toBe('Concrete');
  });

  it('combined: trailing >> + comma-LLC', () => {
    expect(normalizeForExternalQuery('DEKAN REMODELING AND CONSTRUCTION COMPANY, LLC >>'))
      .toBe('DEKAN REMODELING AND CONSTRUCTION COMPANY');
  });

  it('combined: status suffix + space-LLC', () => {
    expect(normalizeForExternalQuery('ACME ROOFING LLC, Delinquent February 1, 2015'))
      .toBe('ACME ROOFING');
  });

  // CRITICAL: end-anchored — does NOT strip mid-string entity tokens
  it('does NOT strip mid-string Inc/Corp tokens (anchored to end only)', () => {
    expect(normalizeForExternalQuery('Acme Inc Corp Holdings'))
      .toBe('Acme Inc Corp Holdings');
  });

  it('passes clean names through unchanged', () => {
    expect(normalizeForExternalQuery('Pinnacle Construction Group'))
      .toBe('Pinnacle Construction Group');
  });

  it('trims leading/trailing whitespace + strips trailing-LLC', () => {
    expect(normalizeForExternalQuery('  Trailing Whitespace LLC  '))
      .toBe('Trailing Whitespace');
  });

  it('collapses internal whitespace + strips trailing-LLC', () => {
    expect(normalizeForExternalQuery('$1.00 Scoop  Ice Cream Shop  LLC'))
      .toBe('$1.00 Scoop Ice Cream Shop');
  });

  // Form-variant coverage
  it('strips L.L.C. dotted form', () => {
    expect(normalizeForExternalQuery('Acme Plumbing L.L.C.'))
      .toBe('Acme Plumbing');
  });

  it('strips Corporation full word', () => {
    expect(normalizeForExternalQuery('Brewster Electric Corporation'))
      .toBe('Brewster Electric');
  });

  it('strips Ltd. with period', () => {
    expect(normalizeForExternalQuery('Cherokee Aggregates, Ltd.'))
      .toBe('Cherokee Aggregates');
  });

  it('strips PC professional corp', () => {
    expect(normalizeForExternalQuery('Smith Engineering PC'))
      .toBe('Smith Engineering');
  });

  it('strips PLLC', () => {
    expect(normalizeForExternalQuery('Jones Law Group PLLC'))
      .toBe('Jones Law Group');
  });

  // Legacy CO SOS markers still work (regression coverage)
  it('strips trailing >>', () => {
    expect(normalizeForExternalQuery('ADATA CORPORATION>>'))
      .toBe('ADATA');
  });

  it('strips single trailing >', () => {
    expect(normalizeForExternalQuery('Mile High Builders, LLC>'))
      .toBe('Mile High Builders');
  });

  // Status-suffix retained from prior helper
  it('strips Voluntarily Dissolved status suffix', () => {
    expect(normalizeForExternalQuery('Acosta Investments, LLC, Voluntarily Dissolved February 27, 2008'))
      .toBe('Acosta Investments');
  });
});
