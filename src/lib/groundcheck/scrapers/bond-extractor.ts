// src/lib/groundcheck/scrapers/bond-extractor.ts
//
// Bond extraction layer. Sits between existing license-scraper raw responses
// and trust_evidence persistence. Parses bond_status, surety_name, claim
// history. Two source-specific parsers (CO DORA JSON / TX TDLR HTML) feed
// into a single BondInfo shape; bondToEvidence() maps BondInfo →
// trust_evidence row contract.
//
// finding_type tokens are aligned with the CHECK extended in mig 242:
//   bond_active | bond_claimed_against | bond_lapsed | bond_not_required
//
// A bond with claims filed against it is the highest-fidelity signal we ship:
// a third party proved harm sufficient to seek recovery from the surety.
// Higher fidelity than BBB rating, OSHA citation count, or unsworn complaints.

export type BondStatus = 'active' | 'lapsed' | 'claimed_against' | 'not_required' | 'unknown'

export interface BondInfo {
  required: boolean
  status: BondStatus
  surety_name?: string
  bond_amount?: number
  effective_date?: string
  expiration_date?: string
  claim_count?: number
  claim_details?: Array<{ filed_at: string; amount: number; resolution?: string }>
}

export interface BondEvidenceRow {
  finding_type: 'bond_active' | 'bond_claimed_against' | 'bond_lapsed' | 'bond_not_required'
  confidence: 'verified_structured' | 'high_llm' | 'medium_llm'
  evidence_summary: string
  extracted_facts: Record<string, unknown>
}

// CO DORA license-detail JSON: field names vary across boards (electrical /
// plumbing / mold remediation use different casing). Common shapes observed:
//   BondRequired / bond_required      (boolean)
//   BondStatus   / bond_status        (string)
//   SuretyCompany / surety_name       (string)
//   BondAmount   / bond_amount        (number)
//   BondEffectiveDate / bond_effective_date
//   BondExpirationDate / bond_expiration_date
//   BondClaims   / bond_claims        (array)

export function extractBondFromCoDoraJson(raw: unknown): BondInfo {
  if (!raw || typeof raw !== 'object') return { required: false, status: 'unknown' }
  const r = raw as Record<string, unknown>

  const get = (k1: string, k2: string) => r[k1] ?? r[k2]

  const required = get('BondRequired', 'bond_required') === true
  if (!required) return { required: false, status: 'not_required' }

  const statusRaw = String(get('BondStatus', 'bond_status') ?? '').toLowerCase()
  const claimsRaw = get('BondClaims', 'bond_claims')
  const claims = Array.isArray(claimsRaw) ? (claimsRaw as Array<Record<string, unknown>>) : []
  const claimCount = claims.length

  let normalized: BondStatus = 'unknown'
  if (claimCount > 0) normalized = 'claimed_against'
  else if (/active|in.?force|effective/.test(statusRaw)) normalized = 'active'
  else if (/lapsed|cancell?ed|terminated|expired/.test(statusRaw)) normalized = 'lapsed'

  return {
    required: true,
    status: normalized,
    surety_name: get('SuretyCompany', 'surety_name') as string | undefined,
    bond_amount: get('BondAmount', 'bond_amount') as number | undefined,
    effective_date: get('BondEffectiveDate', 'bond_effective_date') as string | undefined,
    expiration_date: get('BondExpirationDate', 'bond_expiration_date') as string | undefined,
    claim_count: claimCount,
    claim_details: claims.map(c => ({
      filed_at: String(c['FiledDate'] ?? c['filed_date'] ?? ''),
      amount: Number(c['Amount'] ?? c['amount'] ?? 0),
      resolution: (c['Resolution'] ?? c['resolution']) as string | undefined,
    })),
  }
}

// TX TDLR HTML: bond appears in licensee detail page as labeled <tr>...</tr>
// rows. Conservative parser — returns 'unknown' on structural ambiguity rather
// than guessing. Claims live in the separate TDLR complaint API, not in the
// licensee detail HTML; claim_count is intentionally undefined here.

export function extractBondFromTxTdlrHtml(html: string): BondInfo {
  const reqMatch = html.match(/Bond\s+Required[:\s]*(?:<[^>]+>\s*)+([^<]+)/i)
  if (reqMatch && /^\s*no\s*$/i.test(reqMatch[1])) {
    return { required: false, status: 'not_required' }
  }

  const statusMatch = html.match(/Bond\s+Status[:\s]*(?:<[^>]+>\s*)+([^<]+)/i)
  const amountMatch = html.match(/Bond\s+Amount[:\s]*(?:<[^>]+>\s*)+\$?([\d,]+)/i)
  const expMatch = html.match(/Bond\s+Expir[A-Za-z]+[:\s]*(?:<[^>]+>\s*)+([\d/\-]+)/i)
  const suretyMatch = html.match(/Surety\s+Company[:\s]*(?:<[^>]+>\s*)+([^<]+)/i)

  const statusRaw = statusMatch ? statusMatch[1].toLowerCase() : ''
  let normalized: BondStatus = 'unknown'
  if (/active|in.?force|current/.test(statusRaw)) normalized = 'active'
  else if (/lapsed|cancell?ed|expired|terminated/.test(statusRaw)) normalized = 'lapsed'

  return {
    required: true,
    status: normalized,
    surety_name: suretyMatch ? suretyMatch[1].trim() : undefined,
    bond_amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : undefined,
    expiration_date: expMatch ? expMatch[1] : undefined,
  }
}

/**
 * Map BondInfo → trust_evidence row. Returns null when status='unknown'
 * (no evidence row should be written in that case - the source either didn't
 * expose the field or the parse was structurally ambiguous).
 */
export function bondToEvidence(
  info: BondInfo,
  sourceKey: 'co_dora' | 'tx_tdlr',
): BondEvidenceRow | null {
  if (info.status === 'unknown') return null

  const summaries: Record<Exclude<BondStatus, 'unknown'>, string> = {
    active:
      `Surety bond active${info.surety_name ? ` with ${info.surety_name}` : ''}` +
      `${info.bond_amount ? `, amount $${info.bond_amount.toLocaleString()}` : ''}.`,
    lapsed:
      `Surety bond lapsed${info.expiration_date ? ` (expired ${info.expiration_date})` : ''}.` +
      ` Contractor may not currently meet statutory bonding requirement.`,
    claimed_against:
      `Bond has ${info.claim_count ?? 'one or more'} claim(s) filed against it - a third party ` +
      `successfully proved harm sufficient to seek recovery from the surety.`,
    not_required: 'Bond not required for this license class.',
  }

  const mapping: Record<Exclude<BondStatus, 'unknown'>, BondEvidenceRow['finding_type']> = {
    active: 'bond_active',
    lapsed: 'bond_lapsed',
    claimed_against: 'bond_claimed_against',
    not_required: 'bond_not_required',
  }

  const status = info.status as Exclude<BondStatus, 'unknown'>

  return {
    finding_type: mapping[status],
    confidence: 'verified_structured',
    evidence_summary: summaries[status],
    extracted_facts: { ...info, source_key: sourceKey },
  }
}
