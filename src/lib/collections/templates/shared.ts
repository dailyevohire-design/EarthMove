import { SHORT_DISCLAIMER, UPL_DISCLAIMER } from '../disclaimer'

export interface RenderedDocument {
  title: string
  body: string
  disclaimerHeader: string
  disclaimerFooter: string
}

export function headerBlock(): string {
  return `GENERATED DOCUMENT — NOT LEGAL ADVICE\n${SHORT_DISCLAIMER}`
}

export function footerBlock(): string {
  return UPL_DISCLAIMER
}

export function formatCurrency(cents: number | bigint): string {
  const n = typeof cents === 'bigint' ? Number(cents) : cents
  const dollars = n / 100
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function addressBlock(name: string, address: string): string {
  return `${name}\n${address}`
}

// -----------------------------------------------------------------------------
// customerVerification — Option C marker
//
// Every uncertain statutory question is deferred to the customer's own check
// against the public statute portal. The marker is emitted as a line-prefix
// tagged string that the PDF generator detects and renders as a full-width
// amber callout box (not inline bold red).
//
// Every call MUST:
//   - cite a specific statute section the customer can look up
//   - give a plain-English description aimed at a contractor audience
//   - point to a named section of the instruction packet for context
// -----------------------------------------------------------------------------

export type CustomerVerificationState = 'CO' | 'TX'

export interface CustomerVerificationInput {
  state: CustomerVerificationState
  statuteSection: string   // e.g. "C.R.S. § 38-22-109(3)" or "Tex. Prop. Code § 53.054"
  description: string      // plain-English, contractor-reading-level
  packetSection: string    // e.g. "Step 2 — Notice of Intent to Lien"
}

// Machine-readable sentinel the PDF generator scans for. Single line, all on
// one string; no nested newlines.
const CV_TAG_START = '<<CV '
const CV_TAG_END   = ' CV>>'

export function customerVerification(input: CustomerVerificationInput): string {
  // Sanitize pipe separators out of fields so the tag tokenizer round-trips cleanly.
  const clean = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ').trim()
  return [
    CV_TAG_START,
    clean(input.state),
    clean(input.statuteSection),
    clean(input.packetSection),
    clean(input.description),
    CV_TAG_END,
  ].join('|')
}

// Regex the PDF generator uses to detect markers in the body stream.
export const CV_MARKER_RE = /<<CV \|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\| CV>>/g

export interface ParsedCustomerVerification {
  state: CustomerVerificationState
  statuteSection: string
  packetSection: string
  description: string
}

export function parseCustomerVerification(match: string): ParsedCustomerVerification | null {
  const m = /^<<CV \|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\| CV>>$/.exec(match)
  if (!m) return null
  const [, state, statuteSection, packetSection, description] = m
  if (state !== 'CO' && state !== 'TX') return null
  return { state, statuteSection, packetSection, description }
}

// Back-compat shim for older template calls. Kept only so incremental refactors
// compile; all templates in this commit have migrated to customerVerification.
// If you find yourself using this, you are probably writing an old-style
// template — prefer customerVerification with the structured input.
export function verifyAttorney(state: 'CO' | 'TX', description: string): string {
  return customerVerification({
    state,
    statuteSection: state === 'CO' ? 'C.R.S. (see packet)' : 'Tex. Prop. Code (see packet)',
    description,
    packetSection: 'See "When to call an attorney" section of your instruction packet',
  })
}
