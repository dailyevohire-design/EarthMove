// src/lib/groundcheck/address-classifier.ts
//
// Address classification utility: residential / commercial / mixed_use / pobox
// / virtual_office / unknown. Used by every downstream Groundcheck scraper
// that ingests a registered business address — phoenix detection, lien
// matching, permit name resolution, and synth red-flag scoring.
//
// Strategy:
//  1. Heuristic (cheap, zero-network): regex against the address string for
//     PO Box patterns, virtual-office provider names, Suite/Floor/Plaza
//     markers, and residential street types.
//  2. Assessor fallback: when heuristic returns low_inference / null, hit the
//     relevant county assessor API. CO + TX wired today via mig 242 sources
//     co_assessor + tx_assessor.
//
// confidence tokens are aligned with trust_evidence.confidence CHECK:
//   verified_structured | high_llm | medium_llm | low_inference | unverified
//
// finding_type tokens are aligned with trust_evidence.finding_type CHECK
// extended in mig 242:
//   address_residential_pattern | address_commercial | address_pobox
//   (address_shared_with_dissolved_entity is set by the phoenix detector, not
//   by this utility.)

export type AddressClassification =
  | 'residential'
  | 'commercial'
  | 'mixed_use'
  | 'pobox'
  | 'virtual_office'
  | 'unknown'

export type ClassifyConfidence =
  | 'verified_structured'
  | 'high_llm'
  | 'medium_llm'
  | 'low_inference'
  | 'unverified'

export interface ClassifyResult {
  classification: AddressClassification
  confidence: ClassifyConfidence
  source: 'heuristic' | 'co_assessor' | 'tx_assessor'
  evidence_summary: string
  facts: Record<string, unknown>
}

const POBOX_RE = /\b(p\.?o\.?\s*box|post(?:al)?\s*office\s*box|pmb)\s*#?\s*\d+/i

const VIRTUAL_OFFICE_PROVIDERS = [
  'regus', 'wework', 'spaces', 'intelligent office', 'davinci', 'alliance virtual',
  'opus virtual', 'northwest registered agent', 'registered agents inc',
  'incfile', 'legalzoom', 'zenbusiness', 'harbor compliance',
]

const RESIDENTIAL_HINTS: RegExp[] = [
  /\b(apt|apartment|unit|#)\s*\w+/i,
  /\b\d+\s+\w+\s+(ct|court|ln|lane|pl|place|dr|drive|way|circle|cir|terrace|ter)\b/i,
]

const COMMERCIAL_HINTS: RegExp[] = [
  /\bsuite\s*\w+/i,
  /\bste\.?\s*\w+/i,
  /\bfloor\s*\d+/i,
  /\b(plaza|business\s+park|industrial|corporate|center)\b/i,
]

interface AssessorClient {
  classify(addr: string): Promise<{ use_code: string; description: string } | null>
}

const UA = 'Groundcheck/1.0 (admin@earthmove.io)'
const FETCH_TIMEOUT_MS = 10_000

const denverAssessor: AssessorClient = {
  async classify(addr) {
    try {
      const u = new URL('https://www.denvergov.org/property/realproperty/lookup')
      u.searchParams.set('address', addr)
      const res = await fetch(u, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { property_use?: string; description?: string }
      if (!data?.property_use) return null
      return {
        use_code: String(data.property_use),
        description: String(data.description ?? ''),
      }
    } catch {
      return null
    }
  },
}

const dcadAssessor: AssessorClient = {
  async classify(addr) {
    try {
      const u = new URL('https://www.dallascad.org/SearchAddr.aspx')
      u.searchParams.set('s', addr)
      const res = await fetch(u, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) return null
      const html = await res.text()
      const useMatch = html.match(/Property\s+Type[:\s]*<[^>]+>([^<]+)/i)
      if (!useMatch) return null
      const useDesc = useMatch[1].trim()
      return {
        use_code: useDesc.split(/\s+/)[0]?.toLowerCase() ?? 'unknown',
        description: useDesc,
      }
    } catch {
      return null
    }
  },
}

function heuristicClassify(addr: string): ClassifyResult | null {
  const lower = addr.toLowerCase()

  if (POBOX_RE.test(lower)) {
    return {
      classification: 'pobox',
      confidence: 'verified_structured',
      source: 'heuristic',
      evidence_summary: 'Registered address is a PO Box, which cannot host operations.',
      facts: { pattern: 'pobox', regex_match: addr.match(POBOX_RE)?.[0] ?? null, raw: addr },
    }
  }

  for (const provider of VIRTUAL_OFFICE_PROVIDERS) {
    if (lower.includes(provider)) {
      return {
        classification: 'virtual_office',
        confidence: 'high_llm',
        source: 'heuristic',
        evidence_summary: 'Registered address matches a known virtual-office / mail-forwarding provider.',
        facts: { provider, raw: addr },
      }
    }
  }

  const commercialHits = COMMERCIAL_HINTS.filter(r => r.test(addr)).length
  const residentialHits = RESIDENTIAL_HINTS.filter(r => r.test(addr)).length

  if (commercialHits >= 1 && residentialHits === 0) {
    return {
      classification: 'commercial',
      confidence: 'medium_llm',
      source: 'heuristic',
      evidence_summary: 'Address contains commercial-tenancy markers (Suite, Floor, Plaza, etc.).',
      facts: { commercial_hits: commercialHits, raw: addr },
    }
  }

  if (residentialHits >= 1 && commercialHits === 0) {
    return {
      classification: 'residential',
      confidence: 'low_inference',
      source: 'heuristic',
      evidence_summary: 'Address pattern suggests single-family / multi-family residential.',
      facts: { residential_hits: residentialHits, raw: addr },
    }
  }

  return null
}

function classifyFromAssessorCode(useCode: string, desc: string): AddressClassification {
  const c = useCode.toLowerCase()
  const d = desc.toLowerCase()
  if (/^(r|sf|mf|condo|residential|apartment|townhome)/.test(c)) return 'residential'
  if (c.includes('mixed') || d.includes('mixed')) return 'mixed_use'
  if (/^(c|com|office|retail|industrial|warehouse)/.test(c)) return 'commercial'
  return 'unknown'
}

export async function classifyAddress(
  rawAddress: string,
  stateCode: string,
): Promise<ClassifyResult> {
  if (!rawAddress?.trim()) {
    return {
      classification: 'unknown',
      confidence: 'unverified',
      source: 'heuristic',
      evidence_summary: 'No address provided.',
      facts: {},
    }
  }

  const heuristic = heuristicClassify(rawAddress)
  if (heuristic && heuristic.confidence !== 'low_inference') return heuristic

  const state = stateCode.toUpperCase()
  const assessorClient =
    state === 'CO' ? denverAssessor :
    state === 'TX' ? dcadAssessor :
    null

  if (assessorClient) {
    const result = await assessorClient.classify(rawAddress)
    if (result) {
      const cls = classifyFromAssessorCode(result.use_code, result.description)
      return {
        classification: cls,
        confidence: 'verified_structured',
        source: state === 'CO' ? 'co_assessor' : 'tx_assessor',
        evidence_summary: `County assessor classifies as ${result.description} (${result.use_code}).`,
        facts: {
          assessor_use_code: result.use_code,
          assessor_description: result.description,
          raw: rawAddress,
        },
      }
    }
  }

  return heuristic ?? {
    classification: 'unknown',
    confidence: 'low_inference',
    source: 'heuristic',
    evidence_summary: 'Address could not be classified from heuristic or assessor.',
    facts: { raw: rawAddress },
  }
}

/**
 * Map classification → trust_evidence row contract (finding_type + red-flag flag).
 * Residential at scale + PO Box + virtual office = fraud-pattern signals per
 * the Colorado Construction M.S. LLC reference case. Downstream synth uses
 * is_red_flag to gate score deduction; classification alone does not.
 */
export function classificationToFinding(
  c: ClassifyResult,
  signalStrength: 'normal' | 'high',
): {
  finding_type: 'address_residential_pattern' | 'address_commercial' | 'address_pobox'
  is_red_flag: boolean
} {
  switch (c.classification) {
    case 'residential':
      return { finding_type: 'address_residential_pattern', is_red_flag: signalStrength === 'high' }
    case 'pobox':
    case 'virtual_office':
      return { finding_type: 'address_pobox', is_red_flag: true }
    case 'commercial':
    case 'mixed_use':
    case 'unknown':
    default:
      return { finding_type: 'address_commercial', is_red_flag: false }
  }
}
