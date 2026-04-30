import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../email';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com');
  });

  it('strips +tag for non-Gmail', () => {
    expect(normalizeEmail('alice+work@outlook.com')).toBe('alice@outlook.com');
  });

  it('strips dots and +tag for Gmail', () => {
    expect(normalizeEmail('a.l.i.c.e+spam@gmail.com')).toBe('alice@gmail.com');
  });

  it('unifies googlemail.com to gmail.com', () => {
    expect(normalizeEmail('alice@googlemail.com')).toBe('alice@gmail.com');
    expect(normalizeEmail('a.lice+x@googlemail.com')).toBe('alice@gmail.com');
  });

  it('does NOT strip dots for non-Gmail providers', () => {
    expect(normalizeEmail('first.last@outlook.com')).toBe('first.last@outlook.com');
  });

  it('returns null for invalid input', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('@nolocal.com')).toBeNull();
    expect(normalizeEmail('nodomain@')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});
