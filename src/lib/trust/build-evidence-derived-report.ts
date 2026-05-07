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
  data_integrity_status: 'ok' | 'partial' | 'entity_not_found' | 'degraded' | 'failed'
  data_sources_searched: string[]
  synthesis_model: string
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

export function buildEvidenceDerivedReport(evidence: ScraperEvidence[]): EvidenceDerivedReport {
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
    summary,
    trust_score: trustScore,
    risk_level: riskLevel,
    confidence_level: confidenceLevel,
    data_integrity_status: dataIntegrityStatus,
    data_sources_searched: sourcesSearched,
    synthesis_model: 'templated_evidence_derived',
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
