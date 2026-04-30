/**
 * normalizeEmail — conservative dedup-friendly normalization.
 * Always lowercases. Strips +tag (most providers honor it).
 * For Gmail / googlemail.com: also removes dots in local-part and unifies
 * domain to gmail.com.
 *
 * Returns null for syntactically invalid addresses. Does NOT verify domain
 * MX or check deliverability — that belongs in a separate validator.
 *
 * Important: this is for INTERNAL DEDUP keys. Never use the normalized
 * value as a delivery target — always send to the address the user gave.
 */
const EMAIL_RE = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/;

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  const m = EMAIL_RE.exec(trimmed);
  if (!m) return null;
  let [, local, domain] = m;

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '').replace(/\+.*$/, '');
    domain = 'gmail.com';
  } else {
    local = local.replace(/\+.*$/, '');
  }

  if (!local) return null;
  return `${local}@${domain}`;
}
