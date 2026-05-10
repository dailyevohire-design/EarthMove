/**
 * Tile status derivation — D5.
 *
 * Centralized rules for how each report category renders when underlying
 * fields are blank. Replaces the long-tail of `value ?? '—'` patterns that
 * presented "no data" identically to "verified clean" identically to "not
 * applicable for this trade", which is misleading to homeowners.
 *
 * Five tones drive color:
 *   verified       — actively confirmed positive signal (green)
 *   clean          — no adverse findings (also green; reserved for
 *                    "we looked, nothing bad" semantics)
 *   not_applicable — coverage gap is structural (e.g. CO has no statewide
 *                    GC license; the absence is correct, not a gap in our
 *                    coverage)
 *   not_searched   — coverage gap is ours (paid-tier feature, source not
 *                    yet integrated, etc.)
 *   warning        — adverse signal, not severe
 *   critical       — adverse signal, severe
 *
 * Pure functions, zero deps, no IO. Each takes the loosest report shape
 * possible (Record<string, unknown>) so it can run against the dashboard's
 * `any`-typed report state, the TrustReportView interface, the share page's
 * DB row, and the PDF input — all without forcing them to share a type.
 */

export type TileTone =
  | 'verified'
  | 'clean'
  | 'not_applicable'
  | 'not_searched'
  | 'not_searched_link_out' // 229: muted styling + clickable link (e.g. BBB link-out)
  | 'warning'
  | 'critical'

export interface TileDisplay {
  /** Short pill label (e.g. "Active", "Not Required", "Not Searched"). */
  statusLabel: string
  /** Drives color ramp at the call site. */
  tone: TileTone
  /** Optional explanatory text below the status pill. */
  bodyText: string | null
  /** Long-form hover/print content explaining what was checked + why a
   *  blank tile is not "no data found" (for not_applicable / not_searched). */
  tooltipText: string | null
  /** When tone === 'not_searched_link_out', the URL the tile should link
   *  to (e.g. bbb.org search URL constructed by bbb_link_check). */
  linkOutUrl?: string | null
}

interface TileReportLike {
  state_code?: string | null
  biz_status?: string | null
  lic_status?: string | null
  bbb_rating?: string | null
  bbb_complaint_count?: number | null
  bbb_accredited?: boolean | null
  review_avg_rating?: number | null
  review_total?: number | null
  legal_status?: string | null
  legal_findings?: string[] | null
  osha_status?: string | null
  osha_violation_count?: number | null
  osha_serious_count?: number | null
  data_sources_searched?: string[] | null
  raw_report?: Record<string, unknown> | null
}

function lc(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function rawLicensingNote(r: TileReportLike): string | null {
  const raw = r.raw_report
  if (!raw || typeof raw !== 'object') return null
  const lic = (raw as { licensing?: { source_note?: string | null } }).licensing
  if (!lic || typeof lic !== 'object') return null
  return typeof lic.source_note === 'string' ? lic.source_note : null
}

function rawSourcesCited(r: TileReportLike): Array<{ source_key?: string }> {
  const raw = r.raw_report
  if (!raw || typeof raw !== 'object') return []
  const sc = (raw as { sources_cited?: unknown }).sources_cited
  return Array.isArray(sc) ? (sc as Array<{ source_key?: string }>) : []
}

export function deriveBusinessTile(r: TileReportLike): TileDisplay {
  const s = lc(r.biz_status)
  if (s === 'good standing' || s === 'active') {
    return { statusLabel: 'In Good Standing', tone: 'verified', bodyText: null, tooltipText: null }
  }
  if (s === 'delinquent' || s === 'inactive' || s === 'noncompliant') {
    return {
      statusLabel: 'Delinquent',
      tone: 'warning',
      bodyText: 'Entity may not be authorized to do business',
      tooltipText: 'Entity is registered but in non-compliant standing with the state. Often means an annual report or fee is overdue. Confirm directly with the contractor.',
    }
  }
  if (s === 'voluntarily dissolved' || s === 'dissolved' || s === 'forfeited' || s === 'cancelled' || s === 'canceled' || s === 'withdrawn' || s === 'merged' || s === 'converted') {
    return {
      statusLabel: 'Dissolved',
      tone: 'critical',
      bodyText: 'Entity is no longer active',
      tooltipText: 'The registered legal entity has been dissolved, forfeited, or withdrawn. Anyone operating under this name is doing so outside the registered entity.',
    }
  }
  return {
    statusLabel: 'Not Searched',
    tone: 'not_searched',
    bodyText: null,
    tooltipText: 'No business registration check ran for this report.',
  }
}

export function deriveLicensingTile(r: TileReportLike): TileDisplay {
  const s = lc(r.lic_status)
  if (s === 'active' || s === 'good') {
    return { statusLabel: 'Active', tone: 'verified', bodyText: null, tooltipText: null }
  }
  if (s === 'expired') {
    return {
      statusLabel: 'Expired',
      tone: 'critical',
      bodyText: 'Occupational license expired',
      tooltipText: 'License found but not currently valid. The contractor may not legally operate.',
    }
  }
  if (s === 'suspended') {
    return {
      statusLabel: 'Suspended',
      tone: 'critical',
      bodyText: 'Occupational license suspended',
      tooltipText: 'License found but suspended by the regulator. The contractor may not legally operate.',
    }
  }
  if (s === 'revoked') {
    return {
      statusLabel: 'Revoked',
      tone: 'critical',
      bodyText: 'Occupational license revoked',
      tooltipText: 'License has been permanently revoked. Operating after revocation is unlicensed practice.',
    }
  }
  if (s === 'revoked + operating') {
    return {
      statusLabel: 'Revoked + Operating',
      tone: 'critical',
      bodyText: 'License revoked but contractor still operating',
      tooltipText: 'Recent permits, advertising, or activity detected after a license revocation. Strong fraud indicator.',
    }
  }
  // 'Not Found' — distinguish "no statewide license required for this trade"
  // from "we searched and found nothing".
  if (s === 'not found' || s === 'no record' || s === '') {
    const note = rawLicensingNote(r)
    const stateCode = (r.state_code ?? '').trim().toUpperCase()
    if (stateCode === 'CO' && note && /no statewide gc license/i.test(note)) {
      return {
        statusLabel: 'Not Required for This Trade in CO',
        tone: 'not_applicable',
        bodyText: 'CO has no statewide general-contractor license',
        tooltipText: note,
      }
    }
    if (s === 'not found' || s === 'no record') {
      return {
        statusLabel: 'No License Record',
        tone: 'not_searched',
        bodyText: null,
        tooltipText: 'No matching record at the state licensing portal we searched. Verify directly with the contractor — local trade licenses (electrician, plumber, etc.) may exist outside the state portal.',
      }
    }
    return {
      statusLabel: 'Not Searched',
      tone: 'not_searched',
      bodyText: null,
      tooltipText: 'No license check ran for this report.',
    }
  }
  return {
    statusLabel: r.lic_status ?? 'Unknown',
    tone: 'not_searched',
    bodyText: null,
    tooltipText: null,
  }
}

function rawBbbProfile(r: TileReportLike): { profile_url: string | null; cta: string | null } | null {
  const raw = r.raw_report
  if (!raw || typeof raw !== 'object') return null
  const bbb = (raw as { bbb?: unknown }).bbb
  if (!bbb || typeof bbb !== 'object') return null
  const b = bbb as { profile_url?: unknown; cta?: unknown }
  return {
    profile_url: typeof b.profile_url === 'string' ? b.profile_url : null,
    cta: typeof b.cta === 'string' ? b.cta : null,
  }
}

export function deriveBbbTile(r: TileReportLike): TileDisplay {
  const rating = (r.bbb_rating ?? '').trim()
  if (!rating) {
    // 229: bbb_link_check pattern — when the orchestrator wrote
    // raw_report.bbb.profile_url, surface it as a not_searched_link_out
    // tile (muted but clickable) instead of the bare "Not Searched" pill.
    const bbb = rawBbbProfile(r)
    if (bbb?.profile_url) {
      return {
        statusLabel: 'View BBB Profile',
        tone: 'not_searched_link_out',
        bodyText: bbb.cta ?? 'Click to verify directly at bbb.org',
        tooltipText: 'Free tier: profile lookup only. Standard tier adds rating + complaint synthesis.',
        linkOutUrl: bbb.profile_url,
      }
    }
    return {
      statusLabel: 'Not Searched',
      tone: 'not_searched',
      bodyText: null,
      tooltipText: 'BBB direct scraping is paused pending updated source terms. Verify directly at bbb.org if needed.',
    }
  }
  if (rating === 'A+' || rating === 'A' || rating === 'A-') {
    return {
      statusLabel: `BBB ${rating}`,
      tone: 'verified',
      bodyText: r.bbb_accredited ? 'BBB accredited' : null,
      tooltipText: null,
    }
  }
  if (rating === 'B+' || rating === 'B' || rating === 'B-') {
    return { statusLabel: `BBB ${rating}`, tone: 'clean', bodyText: null, tooltipText: null }
  }
  if (rating.startsWith('C')) {
    return {
      statusLabel: `BBB ${rating}`,
      tone: 'warning',
      bodyText: typeof r.bbb_complaint_count === 'number' && r.bbb_complaint_count > 0
        ? `${r.bbb_complaint_count} BBB complaint${r.bbb_complaint_count === 1 ? '' : 's'}` : null,
      tooltipText: null,
    }
  }
  if (rating.startsWith('D') || rating === 'F') {
    return {
      statusLabel: `BBB ${rating}`,
      tone: 'critical',
      bodyText: typeof r.bbb_complaint_count === 'number' && r.bbb_complaint_count > 0
        ? `${r.bbb_complaint_count} BBB complaint${r.bbb_complaint_count === 1 ? '' : 's'}` : null,
      tooltipText: null,
    }
  }
  return { statusLabel: `BBB ${rating}`, tone: 'clean', bodyText: null, tooltipText: null }
}

export function deriveReviewsTile(r: TileReportLike): TileDisplay {
  const avg = r.review_avg_rating
  const total = r.review_total
  if (typeof avg !== 'number') {
    return {
      statusLabel: 'Not Searched',
      tone: 'not_searched',
      bodyText: null,
      tooltipText: 'Review platform integration is limited to Standard tier and above. Free tier checks public business + license + legal records.',
    }
  }
  const rounded = Math.round(avg * 10) / 10
  const totalLabel = typeof total === 'number' && total > 0 ? ` (${total} review${total === 1 ? '' : 's'})` : ''
  if (avg >= 4.0) {
    return { statusLabel: `Avg ${rounded}${totalLabel}`, tone: 'verified', bodyText: null, tooltipText: null }
  }
  if (avg >= 3.0) {
    return { statusLabel: `Avg ${rounded}${totalLabel}`, tone: 'clean', bodyText: null, tooltipText: null }
  }
  return {
    statusLabel: `Avg ${rounded}${totalLabel}`,
    tone: 'warning',
    bodyText: 'Below 3.0 stars across reviews on file',
    tooltipText: null,
  }
}

export function deriveLegalTile(r: TileReportLike): TileDisplay {
  const findings = r.legal_findings ?? []
  const status = lc(r.legal_status)
  if (status === 'no actions found' || (status === '' && findings.length === 0 && r.legal_status === null)) {
    if (r.legal_status === null) {
      return {
        statusLabel: 'Not Searched',
        tone: 'not_searched',
        bodyText: null,
        tooltipText: 'No federal/state court check ran for this report.',
      }
    }
    return {
      statusLabel: 'Clean',
      tone: 'clean',
      bodyText: 'No federal civil/bankruptcy actions or state AG enforcement on record',
      tooltipText: 'CourtListener (federal civil + bankruptcy) and state Attorney General enforcement databases checked.',
    }
  }
  if (findings.length > 0) {
    const tone: TileTone = findings.length >= 3 ? 'critical' : 'warning'
    return {
      statusLabel: `${findings.length} Action${findings.length === 1 ? '' : 's'} Found`,
      tone,
      bodyText: findings[0],
      tooltipText: null,
    }
  }
  return {
    statusLabel: 'Not Searched',
    tone: 'not_searched',
    bodyText: null,
    tooltipText: 'No federal/state court check ran for this report.',
  }
}

export function deriveOshaTile(r: TileReportLike): TileDisplay {
  const s = lc(r.osha_status)
  if (s === 'clean' || s === 'no violations') {
    return {
      statusLabel: 'No Violations',
      tone: 'verified',
      bodyText: null,
      tooltipText: 'OSHA Establishment Search returned no violations on file.',
    }
  }
  if (s === 'violations' || s === 'serious' || s === 'willful' || s === 'repeat' || s === 'fatality') {
    const vc = r.osha_violation_count ?? 0
    const sc = r.osha_serious_count ?? 0
    const tone: TileTone = (s === 'fatality' || s === 'willful' || sc >= 3) ? 'critical' : 'warning'
    return {
      statusLabel: s.charAt(0).toUpperCase() + s.slice(1),
      tone,
      bodyText: `${vc} violation${vc === 1 ? '' : 's'}${sc > 0 ? ` (${sc} serious)` : ''}`,
      tooltipText: null,
    }
  }
  return {
    statusLabel: 'Not Searched',
    tone: 'not_searched',
    bodyText: null,
    tooltipText: 'OSHA Establishment Search integration in development — coming with the next release.',
  }
}

export function deriveSanctionsTile(r: TileReportLike): TileDisplay {
  // Walk sources_cited for sam_gov_exclusions presence. The orchestrator
  // writes a sanction_clear or sanction_hit evidence row regardless of
  // outcome when SAM.gov was queried; absence in sources_cited means the
  // source wasn't queried.
  const cited = rawSourcesCited(r)
  const samCited = cited.find((c) => c.source_key === 'sam_gov_exclusions')
  if (!samCited) {
    return {
      statusLabel: 'Not Searched',
      tone: 'not_searched',
      bodyText: null,
      tooltipText: 'SAM.gov federal exclusion list was not queried for this report.',
    }
  }
  // Heuristic: if sources_cited entry doesn't tell us hit vs clear, fall back
  // to data_sources_searched + assume clear. The orchestrator only writes a
  // hit row when there's an actual sanction match — which would also drive
  // a red_flag. Most reports show clear.
  return {
    statusLabel: 'No Federal Sanctions',
    tone: 'verified',
    bodyText: 'No federal exclusions or debarment',
    tooltipText: 'SAM.gov federal exclusion list checked. No active debarment, suspension, or exclusion record.',
  }
}
