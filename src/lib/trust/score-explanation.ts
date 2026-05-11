/**
 * Score explanation + industry baseline. Patent-relevant transparency
 * surface (vs ISNetworld's black-box score).
 *
 * As of the score-arithmetic reconciliation: this module is now the
 * SOURCE OF TRUTH for trust_score. buildScoreExplanation computes the
 * final score from per-finding-type rules + categorical caps; the
 * builder reads its return value directly and stops doing its own
 * base-75 arithmetic. Card displays the same numbers without override.
 *
 * Two pure / semi-pure helpers:
 *   buildScoreExplanation(evidence) — pure, deterministic. Returns
 *     base 100 + per-evidence adjustments + final score (sum of deltas
 *     floored at 0, ceilinged at 100). Powers ScoreExplanationCard
 *     "Why this score" view AND the builder's trust_score derivation.
 *   computeIndustryBaseline(stateCode, supabase, contractorScore?) —
 *     reads mv_state_score_baseline (mig 231). Returns per-state median /
 *     percentile snapshot. Best-effort: returns null when no baseline data.
 *
 * Score adjustments are deterministic — same inputs → same numbers.
 * The arithmetic is auditable: every delta has a reason + source +
 * (when available) evidence_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScraperEvidence } from './scrapers/types'

const BASE_SCORE = 100

export interface ScoreAdjustment {
  reason: string
  delta: number
  source: string
  evidence_id: string | null
}

export interface ScoreBreakdown {
  base_score: number
  adjustments: ScoreAdjustment[]
  final_score: number
}

export interface IndustryBaseline {
  scope: 'state'
  state_code: string
  median_score: number
  p25_score: number
  p75_score: number
  mean_score: number
  sample_size: number
  computed_at: string | null
  /** Where the contractor's score sits in the distribution: 0-100.
   *  Approximated from p25/median/p75 buckets. */
  percentile_rank: number | null
}

/**
 * Per-finding-type score deltas. Derived from the same logic as the
 * builder's red_flags / positive_indicators application but explicit so
 * the explanation card can show users *exactly* what each finding cost
 * or earned.
 *
 * Caps are enforced at categorical level (e.g. OSHA citations cap -30
 * total even if there are 5 of them) so a single category doesn't
 * dominate the score.
 */
const ADJUSTMENT_RULES: Array<{
  predicate: (e: ScraperEvidence) => boolean
  delta: number
  reason: (e: ScraperEvidence) => string
  category?: string
  cap?: number
}> = [
  { predicate: (e) => e.finding_type === 'business_inactive', delta: -25, reason: () => 'Business entity is inactive' },
  { predicate: (e) => e.finding_type === 'business_dissolved', delta: -25, reason: () => 'Business entity is dissolved' },
  { predicate: (e) => e.finding_type === 'license_revoked', delta: -25, reason: () => 'Occupational license revoked' },
  { predicate: (e) => e.finding_type === 'license_suspended', delta: -25, reason: () => 'Occupational license suspended' },
  { predicate: (e) => e.finding_type === 'license_revoked_but_operating', delta: -30, reason: () => 'License revoked but contractor still operating' },
  { predicate: (e) => e.finding_type === 'license_expired', delta: -10, reason: () => 'License expired' },
  { predicate: (e) => e.finding_type === 'osha_serious_citation', delta: -10, reason: () => 'OSHA serious citation', category: 'osha', cap: -30 },
  { predicate: (e) => e.finding_type === 'osha_willful_citation', delta: -15, reason: () => 'OSHA willful citation', category: 'osha', cap: -30 },
  { predicate: (e) => e.finding_type === 'osha_repeat_citation', delta: -10, reason: () => 'OSHA repeat citation', category: 'osha', cap: -30 },
  { predicate: (e) => e.finding_type === 'osha_fatality_finding', delta: -25, reason: () => 'Workplace fatality on OSHA record', category: 'osha', cap: -30 },
  { predicate: (e) => e.finding_type === 'legal_action_found', delta: -5, reason: () => 'Civil/legal action on record', category: 'legal', cap: -25 },
  { predicate: (e) => e.finding_type === 'civil_judgment_against', delta: -5, reason: () => 'Civil judgment against contractor', category: 'legal', cap: -25 },
  { predicate: (e) => e.finding_type === 'mechanic_lien_filed', delta: -5, reason: () => 'Mechanic lien filed', category: 'legal', cap: -25 },
  { predicate: (e) => e.finding_type === 'sanction_hit', delta: -50, reason: () => 'Federal exclusion / sanction hit (severe)' },
  { predicate: (e) => e.finding_type === 'phoenix_signal', delta: -15, reason: () => 'Phoenix-LLC pattern: dissolved related entity', category: 'phoenix', cap: -30 },
  { predicate: (e) => e.finding_type === 'open_web_adverse_signal', delta: -2, reason: () => 'Open-web adverse signal (single engine)', category: 'open_web_single', cap: -10 },
  { predicate: (e) => {
      if (e.finding_type !== 'cross_engine_corroboration_event') return false
      const f = (e.extracted_facts ?? {}) as Record<string, unknown>
      return f.claim_direction === 'adverse'
    },
    delta: -3, reason: () => 'Cross-engine corroborated adverse signal', category: 'open_web_corroborated_adverse', cap: -20 },
  // Positives
  { predicate: (e) => e.finding_type === 'bbb_rating_a_plus', delta: 5, reason: () => 'BBB rating A+' },
  { predicate: (e) => e.finding_type === 'bbb_rating_a', delta: 5, reason: () => 'BBB rating A' },
  { predicate: (e) => e.finding_type === 'bbb_rating_b', delta: 2, reason: () => 'BBB rating B' },
  { predicate: (e) => e.finding_type === 'sanction_clear', delta: 5, reason: () => 'No federal sanctions on record' },
  { predicate: (e) => e.finding_type === 'legal_no_actions', delta: 5, reason: () => 'No civil/legal actions found' },
  { predicate: (e) => e.finding_type === 'osha_violations_clean' || e.finding_type === 'osha_no_violations' || e.finding_type === 'osha_inspection_no_violation', delta: 3, reason: () => 'OSHA record clean' },
  { predicate: (e) => e.finding_type === 'federal_contractor_active', delta: 10, reason: () => 'Active federal contractor (federal vetting passed)' },
  { predicate: (e) => {
      if (e.finding_type !== 'cross_engine_corroboration_event') return false
      const f = (e.extracted_facts ?? {}) as Record<string, unknown>
      return f.claim_direction === 'positive'
    },
    delta: 3, reason: () => 'Cross-engine corroborated positive signal', category: 'open_web_corroborated_positive', cap: 9 },
]

export function buildScoreExplanation(
  evidence: Array<ScraperEvidence & { id?: string }>,
): ScoreBreakdown {
  const adjustments: ScoreAdjustment[] = []
  const categoryTotals: Record<string, number> = {}

  for (const e of evidence) {
    for (const rule of ADJUSTMENT_RULES) {
      if (!rule.predicate(e)) continue
      let actualDelta = rule.delta
      if (rule.category && rule.cap !== undefined) {
        const current = categoryTotals[rule.category] ?? 0
        // Negative caps: don't go below cap. Positive caps: don't exceed cap.
        if (rule.cap < 0) {
          if (current <= rule.cap) { continue } // cap already hit, skip further deductions
          if (current + actualDelta < rule.cap) actualDelta = rule.cap - current
        } else {
          if (current >= rule.cap) { continue }
          if (current + actualDelta > rule.cap) actualDelta = rule.cap - current
        }
        categoryTotals[rule.category] = current + actualDelta
      }
      adjustments.push({
        reason: rule.reason(e),
        delta: actualDelta,
        source: e.source_key,
        evidence_id: e.id ?? null,
      })
      break // Each evidence contributes to at most one rule.
    }
  }

  const arithmeticTotal = adjustments.reduce((sum, a) => sum + a.delta, BASE_SCORE)
  const final = Math.max(0, Math.min(100, arithmeticTotal))

  return {
    base_score: BASE_SCORE,
    adjustments,
    final_score: final,
  }
}

export async function computeIndustryBaseline(
  stateCode: string,
  supabase: SupabaseClient,
  contractorScore: number | null = null,
): Promise<IndustryBaseline | null> {
  if (!stateCode) return null
  const { data, error } = await supabase
    .from('mv_state_score_baseline')
    .select('state_code, sample_size, mean_score, median_score, p25_score, p75_score, computed_at')
    .eq('state_code', stateCode.toUpperCase())
    .maybeSingle()

  if (error || !data) return null

  // Approximate percentile rank from the four-point distribution
  // (p25, median, p75). Linear interpolation within each bucket.
  let percentile: number | null = null
  if (typeof contractorScore === 'number') {
    const p25 = Number(data.p25_score)
    const median = Number(data.median_score)
    const p75 = Number(data.p75_score)
    if (contractorScore <= p25) {
      // Below p25 — interpolate against assumed 0-p25 range.
      percentile = Math.round((contractorScore / Math.max(p25, 1)) * 25)
    } else if (contractorScore <= median) {
      percentile = Math.round(25 + ((contractorScore - p25) / Math.max(median - p25, 1)) * 25)
    } else if (contractorScore <= p75) {
      percentile = Math.round(50 + ((contractorScore - median) / Math.max(p75 - median, 1)) * 25)
    } else {
      // Above p75 — interpolate against p75-100.
      percentile = Math.round(75 + ((contractorScore - p75) / Math.max(100 - p75, 1)) * 25)
      percentile = Math.min(99, percentile)
    }
    percentile = Math.max(0, Math.min(99, percentile))
  }

  return {
    scope: 'state',
    state_code: data.state_code as string,
    median_score: Number(data.median_score),
    p25_score: Number(data.p25_score),
    p75_score: Number(data.p75_score),
    mean_score: Number(data.mean_score),
    sample_size: Number(data.sample_size),
    computed_at: (data.computed_at as string | null) ?? null,
    percentile_rank: percentile,
  }
}
