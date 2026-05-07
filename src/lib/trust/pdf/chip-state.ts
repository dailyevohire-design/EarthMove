/**
 * Verification chip state derivation per Juan's PDF redesign spec
 * (2026-05-07 conversation answer #4).
 *
 * Four chips, each in one of four states:
 *   VERIFIED   — record found and good (active license, clean OSHA, A-grade BBB)
 *   MISSING    — source attempted, no record found / no data
 *   FLAGGED    — record found and adverse (suspended license, OSHA willful
 *                violation, BBB F-grade)
 *   UNVERIFIED — source attempted but errored / timed out — distinct from
 *                MISSING per spec, surfaced from trust_evidence rows where
 *                the source's persisted row carried source_errored=true
 *
 * Free-tier reports skip the evidence chain entirely (no Inngest job), so
 * UNVERIFIED is paid-tier-only. The function accepts an optional set of
 * errored source_keys; absent set = no UNVERIFIED chips, MISSING is the
 * fallback.
 */

export type ChipState = 'VERIFIED' | 'MISSING' | 'FLAGGED' | 'UNVERIFIED'

export interface ChipInput {
  biz_status: string | null
  lic_status: string | null
  osha_status: string | null
  bbb_rating: string | null
  /**
   * Set of source_keys whose persisted trust_evidence row had
   * source_errored=true (paid-tier only). Used to lift chips from MISSING
   * → UNVERIFIED for sources that were attempted but failed.
   */
  errored_source_keys?: Set<string>
}

export interface Chip {
  label: string
  state: ChipState
  /** Short human-readable detail under the label (e.g. license number, rating). */
  detail: string | null
}

const REGISTRATION_FLAGGED = new Set(['inactive', 'dissolved', 'delinquent', 'forfeited'])
const LICENSE_FLAGGED = new Set(['expired', 'suspended', 'revoked'])
const OSHA_FLAGGED = new Set(['violations', 'serious', 'willful'])
const BBB_VERIFIED = new Set(['A+', 'A', 'A-'])
const BBB_FLAGGED = new Set(['F', 'D+', 'D', 'D-'])

// Sources that drive each chip — used to consult errored_source_keys.
const REGISTRATION_SOURCES = ['co_sos_biz', 'tx_sos_biz', 'fl_sunbiz']
const LICENSE_SOURCES = ['co_dora', 'tx_tdlr', 'cslb_ca', 'roc_az', 'ccb_or', 'lni_wa', 'dbpr_fl', 'nclbgc_nc']
const OSHA_SOURCES = ['osha_est_search']
const BBB_SOURCES = ['bbb_profile']

function anyErrored(errored: Set<string> | undefined, sources: string[]): boolean {
  if (!errored) return false
  for (const s of sources) {
    if (errored.has(s)) return true
  }
  return false
}

function normalize(s: string | null): string {
  return (s ?? '').trim().toLowerCase()
}

export function deriveChips(input: ChipInput): Chip[] {
  const errored = input.errored_source_keys

  // REGISTRATION (biz_status)
  const biz = normalize(input.biz_status)
  let registration: Chip
  if (biz === 'active') {
    registration = { label: 'Registration', state: 'VERIFIED', detail: 'Active' }
  } else if (REGISTRATION_FLAGGED.has(biz)) {
    registration = { label: 'Registration', state: 'FLAGGED', detail: titleCase(biz) }
  } else if (anyErrored(errored, REGISTRATION_SOURCES)) {
    registration = { label: 'Registration', state: 'UNVERIFIED', detail: 'Source unavailable' }
  } else {
    registration = { label: 'Registration', state: 'MISSING', detail: 'Not found' }
  }

  // LICENSE (lic_status)
  const lic = normalize(input.lic_status)
  let license: Chip
  if (lic === 'active') {
    license = { label: 'License', state: 'VERIFIED', detail: 'Active' }
  } else if (LICENSE_FLAGGED.has(lic)) {
    license = { label: 'License', state: 'FLAGGED', detail: titleCase(lic) }
  } else if (anyErrored(errored, LICENSE_SOURCES)) {
    license = { label: 'License', state: 'UNVERIFIED', detail: 'Source unavailable' }
  } else {
    license = { label: 'License', state: 'MISSING', detail: 'Not found' }
  }

  // SAFETY (osha_status)
  const osha = normalize(input.osha_status)
  let safety: Chip
  if (osha === 'clean') {
    safety = { label: 'Safety', state: 'VERIFIED', detail: 'No OSHA violations' }
  } else if (OSHA_FLAGGED.has(osha)) {
    safety = { label: 'Safety', state: 'FLAGGED', detail: titleCase(osha) + ' violations' }
  } else if (anyErrored(errored, OSHA_SOURCES)) {
    safety = { label: 'Safety', state: 'UNVERIFIED', detail: 'Source unavailable' }
  } else {
    safety = { label: 'Safety', state: 'MISSING', detail: 'No data' }
  }

  // REPUTATION (bbb_rating) — case-sensitive on the rating itself (A+ vs a+)
  const bbb = (input.bbb_rating ?? '').trim()
  let reputation: Chip
  if (BBB_VERIFIED.has(bbb)) {
    reputation = { label: 'Reputation', state: 'VERIFIED', detail: `BBB ${bbb}` }
  } else if (BBB_FLAGGED.has(bbb)) {
    reputation = { label: 'Reputation', state: 'FLAGGED', detail: `BBB ${bbb}` }
  } else if (anyErrored(errored, BBB_SOURCES)) {
    reputation = { label: 'Reputation', state: 'UNVERIFIED', detail: 'Source unavailable' }
  } else {
    reputation = { label: 'Reputation', state: 'MISSING', detail: 'No rating' }
  }

  return [registration, license, safety, reputation]
}

function titleCase(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}
