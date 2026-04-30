import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../phone';

describe('normalizePhone', () => {
  it('parses well-known US formats to E.164', () => {
    expect(normalizePhone('(213) 373-4253')?.e164).toBe('+12133734253');
    expect(normalizePhone('213-373-4253')?.e164).toBe('+12133734253');
    expect(normalizePhone('213.373.4253')?.e164).toBe('+12133734253');
    expect(normalizePhone('+1 213 373 4253')?.e164).toBe('+12133734253');
    expect(normalizePhone('2133734253')?.e164).toBe('+12133734253');
  });

  it('returns null for invalid / garbage input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('not-a-phone')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('555-555-5555-extra-stuff-here')).toBeNull();
  });

  it('captures country', () => {
    const r = normalizePhone('+44 20 7946 0958', 'US');
    expect(r?.e164).toBe('+442079460958');
    expect(r?.country).toBe('GB');
  });

  it('respects defaultCountry for non-prefixed numbers', () => {
    const ca = normalizePhone('416-555-1234', 'CA');
    expect(ca?.e164).toBe('+14165551234');
    expect(ca?.country).toBe('CA');
  });
});
