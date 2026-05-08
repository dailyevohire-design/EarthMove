/**
 * Pure function — derive a trust_reports row shape from a list of
 * ScraperEvidence findings without any LLM call.
 *
 * Used for free-tier reports (templated_evidence_derived). Maps finding_types
 * to the ~20 columns on trust_reports + computes a deterministic trust_score
 * from positive/negative signal counts.
 *
 * data_integrity_status determination (canonical 5 values):
 *   - 'entity_not_found' — every meaningful finding is a *_not_found / *_clear /
 *     *_no_actions / *_no_record AND no positive_or_negative discriminating finding
 *   - 'failed'     — every scraper errored (source_error)
 *   - 'degraded'   — >50% of scrapers errored
 *   - 'partial'    — some sources errored OR core profile fields are NULL
 *   - 'ok'         — all sources succeeded with mixed/positive findings
 */

import type { ScraperEvidence, TrustFindingType } from './scrapers/types'

/**
 * Input type — extends ScraperEvidence with the DB-row fields needed to
 * populate evidence_ids and raw_report.sources_cited. Callers reading from
 * trust_evidence pass id/chain_hash/pulled_at; in-memory callers (tests,
 * fresh-from-scraper paths) can omit them.
 */
export interface BuildReportEvidence extends ScraperEvidence {
  id?: string
  chain_hash?: string | null
  pulled_at?: string | null
}

export interface EvidenceDerivedReport {
  biz_status: string | null
  biz_entity_type: string | null
  biz_formation_date: string | null
  lic_status: string | null
  lic_license_number: string | null
  bbb_rating: string | null
  bbb_accredited: boolean | null
  bbb_complaint_count: number | null
  legal_status: string | null
  legal_findings: string[] | null
  osha_status: string | null
  osha_violation_count: number | null
  osha_serious_count: number | null
  red_flags: string[]
  positive_indicators: string[]
  summary: string | null
  trust_score: number | null
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'AMBIGUOUS' | null
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW' | null
  data_integrity_status: 'ok' | 'partial' | 'entity_not_found' | 'degraded' | 'failed' | 'entity_disambiguation_required'
  data_sources_searched: string[]
  synthesis_model: string
  /** Trust_evidence row ids backing this report — required for QR chain
   *  verification and PDF citation links. Omitted ids (in-memory callers)
   *  are filtered out, so the array length may be less than evidence.length. */
  evidence_ids: string[]
  /** Structured projection of extracted_facts for PDF + share-page consumers.
   *  See raw_report shape comment in buildEvidenceDerivedReport. */
  raw_report: Record<string, unknown>
}

const NULL_FINDING_SUFFIXES = [
  '_not_found', '_no_actions', '_clear', '_no_record', '_no_violations',
  '_no_judgments', '_no_profile', '_not_profiled',
]

function isNullFinding(t: TrustFindingType): boolean {
  return NULL_FINDING_SUFFIXES.some((suffix) => t.endsWith(suffix))
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((x) => x && x.trim().length > 0)))
}

export function buildEvidenceDerivedReport(evidence: BuildReportEvidence[]): EvidenceDerivedReport {
  const sourcesSearched = uniq(evidence.map((e) => e.source_key))
  const errored = evidence.filter((e) => e.finding_type === 'source_error')
  const totalSourceTouches = sourcesSearched.length || 1
  const erroredFraction = errored.length / totalSourceTouches

  const meaningfulFindings = evidence.filter((e) => {
    return e.finding_type !== 'source_error' &&
           e.finding_type !== 'source_not_applicable' &&
           !isNullFinding(e.finding_type)
  })
  const nullFindings = evidence.filter((e) => isNullFinding(e.finding_type))

  const redFlags: string[] = []
  const positiveIndicators: string[] = []

  let bizStatus: string | null = null
  let bizEntityType: string | null = null
  let bizFormationDate: string | null = null
  let licStatus: string | null = null
  let licLicenseNumber: string | null = null
  let bbbRating: string | null = null
  let bbbAccredited: boolean | null = null
  let bbbComplaintCount: number | null = null
  let legalStatus: string | null = null
  const legalFindings: string[] = []
  let oshaStatus: string | null = null
  let oshaViolationCount: number | null = null
  let oshaSeriousCount: number | null = null

  for (const e of evidence) {
    const facts = e.extracted_facts ?? {}
    switch (e.finding_type) {
      // Business entity
      case 'business_active':
        bizStatus = 'Active'
        bizEntityType = bizEntityType ?? (typeof facts.entity_type === 'string' ? facts.entity_type : null)
        bizFormationDate = bizFormationDate ?? (typeof facts.formation_date === 'string' ? facts.formation_date : null)
        positiveIndicators.push('Business entity active in state registry')
        break
      case 'business_inactive':
        bizStatus = 'Inactive'
        redFlags.push('Business entity inactive')
        break
      case 'business_dissolved':
        bizStatus = 'Dissolved'
        redFlags.push('Business entity dissolved')
        break
      case 'business_not_found':
        if (bizStatus === null) bizStatus = 'Not Found'
        break

      // License
      case 'license_active':
        licStatus = 'Active'
        licLicenseNumber = licLicenseNumber ?? (typeof facts.license_number === 'string' ? facts.license_number : null)
        positiveIndicators.push('Active occupational license on file')
        break
      case 'license_expired':
        licStatus = 'Expired'
        redFlags.push('Occupational license expired')
        break
      case 'license_suspended':
        licStatus = 'Suspended'
        redFlags.push('Occupational license suspended')
        break
      case 'license_revoked':
        licStatus = 'Revoked'
        redFlags.push('Occupational license revoked')
        break
      case 'license_revoked_but_operating':
        licStatus = 'Revoked + Operating'
        redFlags.push('License revoked but contractor still operating')
        break
      case 'license_disciplinary_action':
        if (licStatus === null) licStatus = 'Disciplinary Action'
        redFlags.push('Disciplinary action on professional license')
        break
      case 'license_not_found':
      case 'license_no_record':
        if (licStatus === null) licStatus = 'Not Found'
        break

      // OSHA
      case 'osha_no_violations':
      case 'osha_violations_clean':
      case 'osha_inspection_no_violation':
        if (oshaStatus === null) oshaStatus = 'Clean'
        if (oshaViolationCount === null) oshaViolationCount = 0
        if (oshaSeriousCount === null) oshaSeriousCount = 0
        positiveIndicators.push('No OSHA violations on record')
        break
      case 'osha_violation':
        oshaStatus = 'Violations'
        oshaViolationCount = (oshaViolationCount ?? 0) + 1
        redFlags.push('OSHA violation(s) on record')
        break
      case 'osha_serious_citation':
      case 'osha_serious_violation':
        oshaStatus = 'Serious'
        oshaSeriousCount = (oshaSeriousCount ?? 0) + 1
        redFlags.push('Serious OSHA citation')
        break
      case 'osha_willful_citation':
        oshaStatus = 'Willful'
        redFlags.push('Willful OSHA citation')
        break
      case 'osha_repeat_citation':
        if (oshaStatus === null) oshaStatus = 'Repeat'
        redFlags.push('Repeat OSHA citation')
        break
      case 'osha_fatality_finding':
        oshaStatus = 'Fatality'
        redFlags.push('Workplace fatality on OSHA record')
        break

      // Legal
      case 'legal_no_actions':
      case 'civil_no_judgments':
        if (legalStatus === null) legalStatus = 'No Actions Found'
        break
      case 'legal_action_found':
      case 'civil_judgment_against':
      case 'legal_judgment_against':
        legalStatus = 'Action Found'
        legalFindings.push(e.finding_summary)
        redFlags.push('Civil judgment or legal action on record')
        break
      case 'mechanic_lien_filed':
        if (legalStatus === null) legalStatus = 'Lien on Record'
        legalFindings.push(e.finding_summary)
        redFlags.push('Mechanic lien filed')
        break

      // Sanctions
      case 'sanction_clear':
        positiveIndicators.push('No federal exclusions or sanctions')
        break
      case 'sanction_hit':
        redFlags.push('Federal sanction or exclusion list hit')
        break

      // BBB
      case 'bbb_rating_a_plus':
        bbbRating = 'A+'
        positiveIndicators.push('BBB rating A+')
        break
      case 'bbb_rating_a':
        bbbRating = 'A'
        positiveIndicators.push('BBB rating A')
        break
      case 'bbb_rating_b':
        bbbRating = bbbRating ?? 'B'
        break
      case 'bbb_rating_c_or_below':
        bbbRating = bbbRating ?? 'C'
        redFlags.push('BBB rating C or below')
        break
      case 'bbb_complaints_high':
        bbbComplaintCount = typeof facts.complaint_count === 'number' ? facts.complaint_count : (bbbComplaintCount ?? 0)
        redFlags.push('High BBB complaint volume')
        break
      case 'bbb_accredited':
        bbbAccredited = true
        positiveIndicators.push('BBB accredited')
        break

      // Permits
      case 'permit_history_robust':
        positiveIndicators.push('Robust permit history')
        break
      case 'permit_history_clean':
        positiveIndicators.push('Clean permit history')
        break
      case 'permit_scope_violation':
        redFlags.push('Permit scope violation')
        break

      default:
        break
    }
  }

  const dedupRedFlags = uniq(redFlags)
  const dedupPositive = uniq(positiveIndicators)

  let dataIntegrityStatus: EvidenceDerivedReport['data_integrity_status']
  if (errored.length === sourcesSearched.length && sourcesSearched.length > 0) {
    dataIntegrityStatus = 'failed'
  } else if (
    meaningfulFindings.length === 0 &&
    nullFindings.length > 0 &&
    erroredFraction <= 0.5
  ) {
    dataIntegrityStatus = 'entity_not_found'
  } else if (erroredFraction > 0.5) {
    dataIntegrityStatus = 'degraded'
  } else if (errored.length > 0 || (bizStatus === null && licStatus === null)) {
    dataIntegrityStatus = 'partial'
  } else {
    dataIntegrityStatus = 'ok'
  }

  let trustScore: number | null
  let riskLevel: EvidenceDerivedReport['risk_level']
  let confidenceLevel: EvidenceDerivedReport['confidence_level']

  if (dataIntegrityStatus === 'entity_not_found' || dataIntegrityStatus === 'failed') {
    trustScore = null
    riskLevel = null
    confidenceLevel = 'LOW'
  } else {
    const base = 75
    const raw = base - dedupRedFlags.length * 20 + dedupPositive.length * 10
    trustScore = Math.max(0, Math.min(100, raw))
    if (trustScore >= 80) riskLevel = 'LOW'
    else if (trustScore >= 60) riskLevel = 'MEDIUM'
    else if (trustScore >= 40) riskLevel = 'HIGH'
    else riskLevel = 'CRITICAL'
    confidenceLevel = dataIntegrityStatus === 'ok' ? 'MEDIUM' : 'LOW'
  }

  const summary = buildSummary({
    dataIntegrityStatus,
    redFlags: dedupRedFlags,
    positiveIndicators: dedupPositive,
    trustScore,
  })

  // Projection pass: walk evidence by source_key and pull richer extracted_facts
  // into both flat columns (biz_entity_type, biz_formation_date, lic_*, bbb_*)
  // and the raw_report jsonb consumed by the PDF + share-page renderers.
  // Runs AFTER the scoring switch above so the column values from the rich
  // facts override the implicit ones (the switch only extracted entity_type/
  // formation_date for `business_active`, missing inactive/dissolved cases —
  // which is how Bedrock excavating corp / report 53b2733c ended up with
  // null biz_entity_type despite a clean co_sos_biz hit).
  const evidenceIds: string[] = evidence
    .map((e) => e.id)
    .filter((id): id is string => typeof id === 'string')

  const rawBusiness: Record<string, unknown> = {}
  const rawLicensing: Record<string, unknown> = {}
  const rawSanctions: Record<string, unknown> = {}
  const rawLegal: { sources_searched: string[]; findings: string[] } = {
    sources_searched: [],
    findings: [],
  }
  // 229: bbb_link_check projection target. When the bbb_link_constructed
  // finding is present, surface a CTA pointing at the bbb.org search URL
  // — we can't populate bbb_rating/bbb_complaint_count (no data fetched),
  // so the renderer should show a "View BBB Profile →" link instead.
  const rawBbb: Record<string, unknown> = {}
  let bbbSet = false
  const sourcesCited: Array<Record<string, unknown>> = []

  let businessSet = false
  let licensingSet = false
  let sanctionsSet = false

  const SOS_KEYS = new Set([
    'co_sos_biz', 'tx_sos_biz', 'fl_sunbiz', 'ca_sos_biz', 'ny_sos_biz',
    'wa_sos_biz', 'or_sos_biz', 'nc_sos_biz', 'ga_sos_biz', 'az_ecorp',
  ])
  const LICENSE_KEYS = new Set([
    'co_dora', 'tx_tdlr', 'cslb_ca', 'roc_az', 'ccb_or', 'lni_wa',
    'dbpr_fl', 'nclbgc_nc',
  ])
  const LEGAL_KEYS = new Set(['courtlistener_fed', 'state_ag_enforcement'])

  for (const e of evidence) {
    const facts = (e.extracted_facts ?? {}) as Record<string, unknown>
    const str = (k: string): string | null =>
      typeof facts[k] === 'string' && (facts[k] as string).length > 0 ? (facts[k] as string) : null

    if (SOS_KEYS.has(e.source_key)) {
      // Project to flat columns even when the finding wasn't `business_active`
      // (Delinquent/Dissolved entities still have entity_type/formation_date).
      bizEntityType = bizEntityType ?? str('entity_type')
      bizFormationDate = bizFormationDate ?? str('formation_date')

      if (!businessSet) {
        const officers = Array.isArray(facts.officers)
          ? (facts.officers as Array<Record<string, unknown>>)
          : []
        const registeredAgent = officers.find(
          (o) => o && (o as { role_hint?: unknown }).role_hint === 'registered_agent',
        )
        rawBusiness.entity_name = str('entity_name')
        rawBusiness.entity_type = str('entity_type')
        rawBusiness.entity_id = str('entity_id')
        rawBusiness.formation_date = str('formation_date')
        rawBusiness.jurisdiction = str('jurisdiction') ?? str('jurisdiction_of_formation')
        rawBusiness.status = str('status') ?? bizStatus
        rawBusiness.principal_address = str('principal_address')
        rawBusiness.registered_agent =
          registeredAgent && typeof (registeredAgent as { name?: unknown }).name === 'string'
            ? ((registeredAgent as { name: string }).name)
            : (str('registered_agent_organization') ?? null)
        rawBusiness.source_url = str('source_url') ?? str('citation_url')
        businessSet = true
      }
    }

    if (LICENSE_KEYS.has(e.source_key)) {
      licLicenseNumber = licLicenseNumber ?? str('license_number')
      if (!licensingSet) {
        rawLicensing.status = licStatus
        rawLicensing.license_number = str('license_number')
        rawLicensing.expires = str('expires_at') ?? str('expiration_date')
        rawLicensing.source_note = e.finding_summary
        rawLicensing.source_url = str('source_url') ?? str('citation_url')
        licensingSet = true
      }
    }

    if (e.source_key === 'sam_gov_exclusions' && !sanctionsSet) {
      rawSanctions.status = e.finding_type === 'sanction_hit' ? 'hit' : 'clear'
      rawSanctions.source_url = str('source_url') ?? str('citation_url')
      rawSanctions.source_note = e.finding_summary
      sanctionsSet = true
    }

    if (e.source_key === 'osha_est_search') {
      const vc = facts.violation_count
      const sc = facts.serious_count
      if (typeof vc === 'number' && oshaViolationCount === null) oshaViolationCount = vc
      if (typeof sc === 'number' && oshaSeriousCount === null) oshaSeriousCount = sc
    }

    if (e.source_key === 'bbb_profile') {
      bbbRating = bbbRating ?? str('rating')
      const cc = facts.complaint_count
      if (typeof cc === 'number') bbbComplaintCount = cc
      const acc = facts.accredited
      if (typeof acc === 'boolean') bbbAccredited = acc
    }

    // 229: bbb_link_check — surfaces the constructed bbb.org search URL
    // for a "View BBB Profile →" CTA. Does NOT populate bbb_rating /
    // bbb_complaint_count (no fetch, no data). Renderer shows the link
    // in place of a rating tile via raw_report.bbb.profile_url.
    if (e.source_key === 'bbb_link_check' && !bbbSet) {
      const url = str('bbb_search_url') ?? str('citation_url')
      if (url) {
        rawBbb.profile_url = url
        rawBbb.source_method = 'link_construction'
        rawBbb.cta = 'View BBB profile directly →'
        bbbSet = true
      }
    }

    if (LEGAL_KEYS.has(e.source_key)) {
      if (!rawLegal.sources_searched.includes(e.source_key)) {
        rawLegal.sources_searched.push(e.source_key)
      }
      const adverseTypes: TrustFindingType[] = [
        'legal_action_found', 'legal_judgment_against', 'civil_judgment_against',
        'civil_settlement', 'mechanic_lien_filed',
      ]
      if (adverseTypes.includes(e.finding_type)) {
        rawLegal.findings.push(e.finding_summary)
      }
    }

    sourcesCited.push({
      source_key: e.source_key,
      finding_summary: e.finding_summary,
      confidence: e.confidence,
      pulled_at: e.pulled_at ?? null,
      chain_hash: e.chain_hash ?? null,
      citation_url:
        typeof facts.citation_url === 'string' ? (facts.citation_url as string)
        : typeof facts.search_url === 'string' ? (facts.search_url as string)
        : null,
    })
  }

  const rawReport: Record<string, unknown> = {
    business: businessSet ? rawBusiness : null,
    licensing: licensingSet ? rawLicensing : null,
    sanctions: sanctionsSet ? rawSanctions : null,
    legal: rawLegal,
    bbb: bbbSet ? rawBbb : null,
    sources_cited: sourcesCited,
  }

  // 227: entity disambiguation projection.
  // The orchestrator writes a single 'entity_disambiguation_candidates'
  // evidence row when the exact-match round missed but candidate-search
  // found similar names. Project that into raw_report.disambiguation and
  // override data_integrity_status — the renderer (NoEntityFoundCard +
  // EntityDisambiguationCard) reads off both.
  const disambigEvidence = evidence.find(
    (e) => e.finding_type === 'entity_disambiguation_candidates',
  )
  if (disambigEvidence) {
    const facts = disambigEvidence.extracted_facts ?? {}
    const candidates = Array.isArray(facts.candidates) ? facts.candidates : []
    const query = typeof facts.query === 'string' ? facts.query : null
    rawReport.disambiguation = { candidates, query }
    dataIntegrityStatus = 'entity_disambiguation_required'
    trustScore = null
    riskLevel = null
    confidenceLevel = 'LOW'
  }

  // 227: name-discrepancy projection (independent of disambiguation —
  // can co-occur with any data_integrity_status). The orchestrator writes
  // 'name_discrepancy_observed' at the head of the chain when the user
  // arrived via a click-through with a different searched_as. Project to
  // a red flag + raw_report.name_discrepancy.
  const discrepancyEvidence = evidence.find(
    (e) => e.finding_type === 'name_discrepancy_observed',
  )
  if (discrepancyEvidence) {
    const facts = discrepancyEvidence.extracted_facts ?? {}
    dedupRedFlags.unshift(
      'Solicited under a name that does not match registered legal entity — independent fraud indicator',
    )
    rawReport.name_discrepancy = {
      searched_as: typeof facts.searched_as === 'string' ? facts.searched_as : null,
      canonical_name: typeof facts.canonical_name === 'string' ? facts.canonical_name : null,
    }
  }

  // 227: when disambiguation is required, override the summary with a
  // user-facing call-to-action. Build last so it sees the final candidate count.
  let finalSummary = summary
  if (dataIntegrityStatus === 'entity_disambiguation_required' && disambigEvidence) {
    const facts = disambigEvidence.extracted_facts ?? {}
    const candidates = Array.isArray(facts.candidates) ? facts.candidates : []
    const query = typeof facts.query === 'string' ? facts.query : 'this name'
    finalSummary = `We didn't find an exact match for "${query}". Found ${candidates.length} similar registered entities — review and select the correct one to run the full report.`
  }

  return {
    biz_status: bizStatus,
    biz_entity_type: bizEntityType,
    biz_formation_date: bizFormationDate,
    lic_status: licStatus,
    lic_license_number: licLicenseNumber,
    bbb_rating: bbbRating,
    bbb_accredited: bbbAccredited,
    bbb_complaint_count: bbbComplaintCount,
    legal_status: legalStatus,
    legal_findings: legalFindings.length > 0 ? legalFindings : null,
    osha_status: oshaStatus,
    osha_violation_count: oshaViolationCount,
    osha_serious_count: oshaSeriousCount,
    red_flags: dedupRedFlags,
    positive_indicators: dedupPositive,
    summary: finalSummary,
    trust_score: trustScore,
    risk_level: riskLevel,
    confidence_level: confidenceLevel,
    data_integrity_status: dataIntegrityStatus,
    data_sources_searched: sourcesSearched,
    synthesis_model: 'templated_evidence_derived',
    evidence_ids: evidenceIds,
    raw_report: rawReport,
  }
}

function buildSummary(args: {
  dataIntegrityStatus: EvidenceDerivedReport['data_integrity_status']
  redFlags: string[]
  positiveIndicators: string[]
  trustScore: number | null
}): string {
  if (args.dataIntegrityStatus === 'entity_not_found') {
    return 'No public business record matched the searched name in the sources we checked. Absence of public records is not a clean record — verify in person.'
  }
  if (args.dataIntegrityStatus === 'failed') {
    return 'Public-records sources were unavailable at the time of this search. Try again, or upgrade for a deep-dive that retries failed sources.'
  }
  if (args.dataIntegrityStatus === 'degraded') {
    return 'More than half of the public-records sources errored on this search. The findings shown here are based on partial coverage.'
  }
  const score = args.trustScore ?? 0
  const flagCount = args.redFlags.length
  const positiveCount = args.positiveIndicators.length
  if (flagCount === 0 && positiveCount > 0) {
    return `Trust score ${score}/100. ${positiveCount} positive indicator${positiveCount === 1 ? '' : 's'} on file and no red flags surfaced.`
  }
  if (flagCount > 0 && positiveCount === 0) {
    return `Trust score ${score}/100. ${flagCount} red flag${flagCount === 1 ? '' : 's'} surfaced — review the details before contracting.`
  }
  if (flagCount > 0 && positiveCount > 0) {
    return `Trust score ${score}/100. ${flagCount} red flag${flagCount === 1 ? '' : 's'} and ${positiveCount} positive indicator${positiveCount === 1 ? '' : 's'} on record.`
  }
  return `Trust score ${score}/100. Public-records search returned no notable findings either way.`
}
