/**
 * Tile-level source provenance.
 *
 * Resolves the {displayName, pulledAt, citationUrl} triple needed to render
 * a "Source: <X> · Pulled <Y> ago · Verify on official record →" footer
 * underneath each report tile. Single source of truth so all four render
 * surfaces (TrustReportView, ContractorCheckClient, share page, PDF)
 * format provenance identically.
 *
 * Pure: zero IO. Walks raw_report.sources_cited[] which the orchestrator
 * already populated at write time.
 *
 * For not_searched / not_searched_link_out tones, callers should NOT show
 * a "Pulled X ago" line — instead show "Not searched in this tier" so the
 * user understands the absence is structural, not stale data. The status
 * field on the return distinguishes these.
 */

const DISPLAY_NAMES: Record<string, string> = {
  co_sos_biz: 'Colorado Secretary of State',
  tx_sos_biz: 'Texas Comptroller of Public Accounts',
  fl_sunbiz: 'Florida SunBiz',
  ca_sos_biz: 'California Secretary of State',
  ny_sos_biz: 'New York Department of State',
  wa_sos_biz: 'Washington Corporations + Charities',
  or_sos_biz: 'Oregon Business Registry',
  nc_sos_biz: 'North Carolina Secretary of State',
  ga_sos_biz: 'Georgia Secretary of State',
  az_ecorp: 'Arizona Corporation Commission',
  co_dora: 'Colorado DORA Licensing',
  tx_tdlr: 'Texas TDLR',
  cslb_ca: 'California Contractors State License Board',
  ccb_or: 'Oregon CCB',
  roc_az: 'Arizona Registrar of Contractors',
  lni_wa: 'Washington L&I',
  dbpr_fl: 'Florida DBPR',
  nclbgc_nc: 'North Carolina LBGC',
  sam_gov_exclusions: 'SAM.gov Federal Exclusions',
  courtlistener_fed: 'CourtListener Federal Dockets',
  state_ag_enforcement: 'State Attorney General Enforcement',
  osha_est_search: 'OSHA Establishment Search',
  bbb_link_check: 'BBB (link-out only)',
  bbb_profile: 'Better Business Bureau',
  google_reviews: 'Google Reviews',
  denver_pim: 'Denver Open Permits',
  dallas_open_data: 'Dallas Open Data — Permits',
  denver_cpd: 'Denver Community Planning + Development',
  system_internal: 'Groundcheck Internal',
}

interface SourceCited {
  source_key?: string
  pulled_at?: string | null
  citation_url?: string | null
}

interface ProvenanceReportLike {
  raw_report?: Record<string, unknown> | null
}

export interface TileProvenance {
  displayName: string
  pulledAt: string | null
  pulledAtRelative: string | null
  citationUrl: string | null
  status: 'fetched' | 'not_searched'
}

function sourcesCited(r: ProvenanceReportLike): SourceCited[] {
  const raw = r.raw_report
  if (!raw || typeof raw !== 'object') return []
  const sc = (raw as { sources_cited?: unknown }).sources_cited
  return Array.isArray(sc) ? (sc as SourceCited[]) : []
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function relativeTimeFrom(iso: string | null | undefined, nowIso?: string): string | null {
  if (!iso) return null
  const pulled = new Date(iso)
  if (isNaN(pulled.getTime())) return null
  const now = nowIso ? new Date(nowIso) : new Date()
  const seconds = Math.max(0, Math.round((now.getTime() - pulled.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${pluralize(minutes, 'minute')} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${pluralize(hours, 'hour')} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${pluralize(days, 'day')} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${pluralize(months, 'month')} ago`
  const years = Math.round(months / 12)
  return `${pluralize(years, 'year')} ago`
}

export function tileProvenance(
  report: ProvenanceReportLike,
  sourceKey: string,
): TileProvenance {
  const cited = sourcesCited(report).find((c) => c.source_key === sourceKey)
  const displayName = DISPLAY_NAMES[sourceKey] ?? sourceKey
  if (!cited) {
    return {
      displayName,
      pulledAt: null,
      pulledAtRelative: null,
      citationUrl: null,
      status: 'not_searched',
    }
  }
  return {
    displayName,
    pulledAt: cited.pulled_at ?? null,
    pulledAtRelative: relativeTimeFrom(cited.pulled_at),
    citationUrl: cited.citation_url ?? null,
    status: 'fetched',
  }
}

/**
 * Multi-source provenance — for tiles backed by more than one source key
 * (e.g. Legal Records pulls from courtlistener_fed + state_ag_enforcement).
 * Returns the most recent fetched provenance, or a not_searched stub if
 * neither source ran.
 */
export function tileProvenanceMulti(
  report: ProvenanceReportLike,
  sourceKeys: string[],
): TileProvenance {
  const fetched = sourceKeys
    .map((k) => tileProvenance(report, k))
    .filter((p) => p.status === 'fetched')
  if (fetched.length === 0) {
    return {
      displayName: sourceKeys.map((k) => DISPLAY_NAMES[k] ?? k).join(' + '),
      pulledAt: null,
      pulledAtRelative: null,
      citationUrl: null,
      status: 'not_searched',
    }
  }
  // Most recent
  fetched.sort((a, b) => {
    const ta = a.pulledAt ? Date.parse(a.pulledAt) : 0
    const tb = b.pulledAt ? Date.parse(b.pulledAt) : 0
    return tb - ta
  })
  return fetched[0]
}
