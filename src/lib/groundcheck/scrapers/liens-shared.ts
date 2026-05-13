// src/lib/groundcheck/scrapers/liens-shared.ts
//
// Shared types + logic for mechanic's lien scrapers. Per-county adapters
// (Denver Clerk and Recorder, Adams County, Jefferson County, etc.) feed
// LienRecord[] into a LienWindow, which scoreLienWindow() converts into
// LienFinding rows for trust_evidence persistence.
//
// The entire fraud signal in mechanic's-lien data is DIRECTIONAL:
//
//   AGAINST the contractor (contractor named as debtor):
//     A subcontractor or material supplier filed a lien because they
//     allege the contractor failed to pay them for work performed or
//     materials delivered. This is the fraud signal — the contractor
//     took the client's money but didn't pay the people who did the work.
//
//   BY the contractor (contractor named as claimant):
//     The contractor filed a lien because they allege a client failed to
//     pay them. This is normal construction-industry collections activity
//     and is NOT a fraud signal.
//
// finding_type tokens are aligned with mig 242:
//   mechanic_lien_against_contractor | mechanic_lien_by_contractor | lien_clear

export type LienDirection = 'against_contractor' | 'by_contractor' | 'unknown'

export interface LienRecord {
  filing_id: string
  filed_at: string
  recorded_in_county: string
  claimant_name: string
  debtor_name: string
  amount?: number
  property_address?: string
  direction: LienDirection
  release_recorded?: boolean
  release_recorded_at?: string
  source_url?: string
}

export interface LienWindow {
  source_key: string
  state_code: string
  searched_name: string
  liens: LienRecord[]
  counties_searched: string[]
  search_url: string
  pulled_at: string
  raw_response_sha256: string
}

export interface LienFinding {
  finding_type:
    | 'mechanic_lien_against_contractor'
    | 'mechanic_lien_by_contractor'
    | 'lien_clear'
  confidence: 'verified_structured' | 'high_llm' | 'medium_llm'
  evidence_summary: string
  extracted_facts: Record<string, unknown>
}

// Strip common entity-suffix tokens so "Bedrock Excavating LLC" and
// "Bedrock Excavating, Inc." both normalize to "bedrock excavating".
// Allows partial-match scoring across the LLC --> LLC2 --> LLC3 phoenix
// pattern where a single human registers serial entity variants.
const ENTITY_SUFFIX_RE = /\b(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|company|co\.?|ltd\.?|llp|pllc|plc)\b/gi

export function normalizeBusinessName(name: string | null | undefined): string {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .replace(ENTITY_SUFFIX_RE, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Direction classification uses bidirectional substring match against the
// normalized names. This intentionally accepts false positives over false
// negatives because:
//
//   1) Lien data is reviewed by humans before consumer-facing display
//      (trust_report_audit captures every score change with change_source).
//   2) Missing a real "against contractor" lien is a worse outcome than
//      flagging a near-match for review (fraud-signal severity asymmetry).
//
// If "Bedrock Excavating" is being searched and a lien names "Bedrock
// Excavating Corp" as debtor, the includes() match fires correctly. If a
// lien names a wholly unrelated "Bedrock" entity (rare), it fires too --
// noise to be filtered downstream by officer-graph + address overlap.

export function classifyLienDirection(
  lien: { claimant_name: string; debtor_name: string },
  contractorName: string,
): LienDirection {
  const contractorNorm = normalizeBusinessName(contractorName)
  if (!contractorNorm) return 'unknown'

  const claimantNorm = normalizeBusinessName(lien.claimant_name)
  const debtorNorm = normalizeBusinessName(lien.debtor_name)

  const inDebtor = !!debtorNorm && (
    debtorNorm.includes(contractorNorm) || contractorNorm.includes(debtorNorm)
  )
  const inClaimant = !!claimantNorm && (
    claimantNorm.includes(contractorNorm) || contractorNorm.includes(claimantNorm)
  )

  // Contractor appears as both claimant AND debtor on the same lien:
  // structurally ambiguous (could be bad data, or shared corporate
  // structure across related entities). Don't guess.
  if (inDebtor && inClaimant) return 'unknown'
  if (inDebtor) return 'against_contractor'
  if (inClaimant) return 'by_contractor'
  return 'unknown'
}

export function scoreLienWindow(window: LienWindow): LienFinding[] {
  const findings: LienFinding[] = []
  const against = window.liens.filter(l => l.direction === 'against_contractor')
  const by = window.liens.filter(l => l.direction === 'by_contractor')

  if (against.length > 0) {
    const unresolved = against.filter(l => !l.release_recorded)
    const totalAmount = against.reduce((s, l) => s + (l.amount ?? 0), 0)
    findings.push({
      finding_type: 'mechanic_lien_against_contractor',
      confidence: 'verified_structured',
      evidence_summary:
        against.length + " mechanic's lien(s) filed against this contractor " +
        "by subcontractors or suppliers in searched counties (" +
        unresolved.length + " unresolved). Public record of alleged " +
        "nonpayment to crew or vendors.",
      extracted_facts: {
        total: against.length,
        unresolved_count: unresolved.length,
        total_claimed_amount: totalAmount,
        counties: Array.from(new Set(against.map(l => l.recorded_in_county))),
        examples: against.slice(0, 5).map(l => ({
          filing_id: l.filing_id,
          claimant: l.claimant_name,
          county: l.recorded_in_county,
          filed_at: l.filed_at,
          amount: l.amount,
          released: l.release_recorded ?? false,
        })),
      },
    })
  }

  if (by.length > 0) {
    findings.push({
      finding_type: 'mechanic_lien_by_contractor',
      confidence: 'verified_structured',
      evidence_summary:
        by.length + " mechanic's lien(s) filed by this contractor against " +
        "clients (normal collections activity in the construction industry).",
      extracted_facts: {
        total: by.length,
        counties: Array.from(new Set(by.map(l => l.recorded_in_county))),
        examples: by.slice(0, 5).map(l => ({
          filing_id: l.filing_id,
          debtor: l.debtor_name,
          county: l.recorded_in_county,
          filed_at: l.filed_at,
          amount: l.amount,
        })),
      },
    })
  }

  if (against.length === 0 && by.length === 0) {
    findings.push({
      finding_type: 'lien_clear',
      confidence: 'verified_structured',
      evidence_summary:
        'No mechanic\'s liens on record involving "' + window.searched_name +
        '" across ' + window.counties_searched.length + ' searched counties (' +
        window.counties_searched.join(', ') + ').',
      extracted_facts: {
        counties_searched: window.counties_searched,
        searched_name: window.searched_name,
      },
    })
  }

  return findings
}
