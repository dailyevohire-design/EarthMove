import { getDomain } from 'tldts';

/**
 * Source URL allowlist for the Trust scraper pipeline.
 *
 * Contract: every URL emitted by an LLM (Anthropic web_search citations,
 * model-generated text, scraper output) MUST pass isAllowedSourceUrl()
 * before any network fetch. Failure to gate creates SSRF + indirect-prompt-
 * injection blast radius (see CVE category, OWASP LLM01:2025).
 *
 * Two-tier check:
 *   1. EXACT_HOSTS — full hostname match (most precise; use for high-trust
 *      narrow targets like 'api.sam.gov' where we don't want to admit
 *      arbitrary sam.gov subdomains).
 *   2. ALLOWED_REGISTRABLE — registrable-domain (eTLD+1) match via tldts.
 *      Admits any subdomain of a trusted root. Public-suffix-aware so
 *      'evil.com.gov' resolves to registrable 'com.gov' which is NOT in the
 *      set, while 'subdomain.osha.gov' resolves to 'osha.gov' which IS.
 *
 * We deliberately reject:
 *   - non-https URLs
 *   - any URL whose registrable domain isn't in the allowlist
 *   - URLs whose hostname includes credentials (user:pass@host)
 *
 * The allowlist is seeded from trust_source_registry.base_url for the
 * sources currently registered as is_active = true. When new scrapers
 * register, add the registrable here OR (preferred) move this to a
 * runtime-loaded allowlist driven by trust_source_registry.
 */

// Registrable domains (eTLD+1 as tldts computes them).
const ALLOWED_REGISTRABLE = new Set<string>([
  // Federal / public
  'bbb.org',
  'courtlistener.com',
  'osha.gov',
  'sam.gov',
  'sec.gov',
  'usaspending.gov',
  'googleapis.com',
  // State business entity portals
  'azcc.gov',         // AZ corp commission
  'ca.gov',           // CA SOS (bizfileonline.sos.ca.gov)
  'coloradosos.gov',  // CO SOS
  'sunbiz.org',       // FL SOS
  'sos.ga.gov',       // GA SOS — registrable depends on PSL; both forms covered via EXACT_HOSTS
  'ga.gov',           // GA fallback
  'sosnc.gov',        // NC SOS
  'ny.gov',           // NY SOS (apps.dos.ny.gov)
  'state.or.us',      // OR SOS (secure.sos.state.or.us) — depends on PSL handling of state.<st>.us
  'or.us',            // OR fallback
  'state.tx.us',      // TX SOS (www.sos.state.tx.us)
  'tx.us',            // TX fallback
  'wa.gov',           // WA SOS + WA L&I
  // State licensing portals
  'denvergov.org',          // Denver contractor licensing (CO municipal)
  'myfloridalicense.com',   // FL DBPR (intentionally .com)
  'oregon.gov',             // OR CCB
  'nclbgc.org',             // NC general contractors
  'az.gov',                 // AZ ROC
]);

// Exact-host matches (overrides — admit only this specific host, no siblings).
const EXACT_HOSTS = new Set<string>([
  'api.sam.gov',
  'efts.sec.gov',
  'api.usaspending.gov',
  'maps.googleapis.com',
  'www.bbb.org',
  'www.courtlistener.com',
]);

export interface AllowlistResult {
  allowed: boolean;
  hostname: string | null;
  registrableDomain: string | null;
  reason?: 'invalid_url' | 'not_https' | 'has_credentials' | 'host_not_allowed';
}

export function isAllowedSourceUrl(raw: string): AllowlistResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { allowed: false, hostname: null, registrableDomain: null, reason: 'invalid_url' };
  }

  if (u.protocol !== 'https:') {
    return { allowed: false, hostname: u.hostname, registrableDomain: null, reason: 'not_https' };
  }
  if (u.username || u.password) {
    return { allowed: false, hostname: u.hostname, registrableDomain: null, reason: 'has_credentials' };
  }

  const host = u.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) {
    return { allowed: true, hostname: host, registrableDomain: getDomain(host) ?? null };
  }

  const reg = getDomain(host, { allowPrivateDomains: false });
  if (reg && ALLOWED_REGISTRABLE.has(reg)) {
    return { allowed: true, hostname: host, registrableDomain: reg };
  }

  return { allowed: false, hostname: host, registrableDomain: reg ?? null, reason: 'host_not_allowed' };
}
