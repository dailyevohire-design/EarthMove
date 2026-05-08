import type { CleanHints } from "./prompt-guards"
import type { TrustReport } from "./trust-validator"
import { runTrustOrchestratorV2 } from "./orchestrator-v2"
import { TIER_CONFIG, resolveScrapersForTier } from "./tier-config"
import { expandContractorNameVariants } from "./name-variants"
/**
 * @deprecated Routes through runTrustOrchestratorV2 — call orchestrator
 * directly in new code. This shim is preserved for back-compat with the
 * existing src/app/api/trust/route.ts call site and the redemption.test mock
 * shape; it returns the same wrapper but the inner report is now the
 * deterministic templated_evidence_derived shape rather than the LLM-narrated
 * shape, and cost/Sonar fields are zeroed (no Sonar/Anthropic call happens).
 *
 * The orchestrator inserts a trust_reports row + creates a trust_jobs row
 * itself, so callers should detect `report_id` on the return and skip their
 * own DB write to avoid duplicate inserts.
 */
export interface FreeTierClickThrough {
  /** Original user query when the canonical legal name from the
   *  click-through differs. Drives the name-discrepancy fraud signal. */
  searched_as?: string | null
  /** entity_id from the candidate the user clicked. Recorded in raw_report
   *  for audit. */
  entity_id_from_click?: string | null
  /** source_key the entity_id came from. */
  entity_source_from_click?: string | null
}

export async function runFreeTier(
  name: string,
  city: string,
  state: string,
  _onSearch?: (q: string) => void,
  _hints?: CleanHints | null,
  requestedByUserId?: string | null,
  clickThrough?: FreeTierClickThrough,
): Promise<{
  report: TrustReport & { report_id: string; job_id: string }
  report_id: string
  job_id: string
  searches: string[]
  costUsd: number
  tokensIn: number
  tokensOut: number
  cacheReadTokens: number
  cacheCreationTokens: number
  piiHits: string[]
  sonarUsed: boolean
  sonarCitations: string[]
  sonarTokensIn: number
  sonarTokensOut: number
}> {
  const scraperKeys = await resolveScrapersForTier('free', state)
  // 227: when the user clicked through entity disambiguation, skip name
  // variant expansion — the click already provided the canonical legal
  // name, and exact-match against the canonical SOS row should hit cleanly.
  const cameFromClick = Boolean(clickThrough?.entity_id_from_click)
  const result = await runTrustOrchestratorV2(
    {
      contractor_name: name,
      state_code: state,
      city: city || null,
      requested_by_user_id: requestedByUserId ?? null,
      searched_as: clickThrough?.searched_as ?? null,
      entity_id_from_click: clickThrough?.entity_id_from_click ?? null,
      entity_source_from_click: clickThrough?.entity_source_from_click ?? null,
    },
    {
      ...TIER_CONFIG.free,
      tier: 'free',
      scraperKeys,
      // Click-through path: skip variant expansion — canonical name is what
      // the user picked from the disambiguation card. Regular path: expand.
      nameVariants: cameFromClick
        ? [name]
        : expandContractorNameVariants(name, TIER_CONFIG.free.nameVariantLimit),
    },
  )

  if (result.kind !== 'sync_complete') {
    throw new Error(`runFreeTier: unexpected orchestrator outcome ${result.kind}`)
  }

  const r = result.report
  const wrappedReport = {
    // Identity fields — REQUIRED for client-side renderers that read these
    // off the response (e.g. ContractorCheckClient.tsx renders the H2 from
    // report.contractor_name; the entity_not_found branch passes it to
    // expandContractorNameVariants which throws on undefined.trim()).
    contractor_name:    r.contractor_name,
    city:               r.city,
    state_code:         r.state_code,
    // Flat fields the new orchestrator returns
    trust_score:        r.trust_score,
    risk_level:         r.risk_level,
    confidence_level:   r.confidence_level,
    summary:            r.summary,
    red_flags:          r.red_flags,
    positive_indicators: r.positive_indicators,
    data_sources_searched: r.data_sources_searched,
    data_integrity_status: r.data_integrity_status,
    synthesis_model:    r.synthesis_model,
    // Legacy nested shape that route.ts:377+ reads. Keep for back-compat
    // until the route is refactored to read flat fields directly.
    business_registration: { status: r.biz_status, entity_type: r.biz_entity_type, formation_date: r.biz_formation_date },
    licensing:             { status: r.lic_status, license_number: r.lic_license_number },
    bbb_profile:           { rating: r.bbb_rating, accredited: r.bbb_accredited, complaint_count: r.bbb_complaint_count },
    legal_records:         { status: r.legal_status, findings: r.legal_findings },
    osha_violations:       { status: r.osha_status, violation_count: r.osha_violation_count, serious_count: r.osha_serious_count },
    reviews:               null as null | Record<string, unknown>,
    report_tier:           'free',
    report_id:             result.report_id,
    job_id:                result.job_id,
    // 227: surface searched_as on the API response so the dashboard can show
    // the discrepancy banner without re-fetching the trust_reports row.
    searched_as:           clickThrough?.searched_as ?? null,
  } as unknown as TrustReport & { report_id: string; job_id: string }

  return {
    report: wrappedReport,
    report_id: result.report_id,
    job_id: result.job_id,
    searches: r.data_sources_searched,
    costUsd: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    piiHits: [],
    sonarUsed: false,
    sonarCitations: [],
    sonarTokensIn: 0,
    sonarTokensOut: 0,
  }
}
