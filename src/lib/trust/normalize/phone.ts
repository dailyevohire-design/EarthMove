import { parsePhoneNumberWithError } from 'libphonenumber-js/min';

export interface NormalizedPhone {
  e164: string;
  country: string | undefined;
}

/**
 * Parse and normalize a phone number to E.164. Returns null on invalid input.
 * Default country US per launch markets. Production code should specify
 * defaultCountry explicitly when known (e.g., from contractor's state_code).
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: 'US' | 'CA' = 'US',
): NormalizedPhone | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const p = parsePhoneNumberWithError(raw, defaultCountry);
    if (!p.isValid()) return null;
    return { e164: p.number, country: p.country };
  } catch {
    return null;
  }
}
