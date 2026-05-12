/**
 * Project a contractor_trust_scores.inputs_snapshot jsonb into the
 * ScoreBreakdown shape rendered by ScoreExplanationCard ("Why this score").
 *
 * Source of truth for free-tier scoring is now the SQL pipeline
 * (calculate_contractor_trust_score). This helper translates its
 * per-category sub-scores + weights + dampener + hard caps into the
 * card's adjustments[] timeline. Mirrors the SQL helper
 * trust_inputs_to_score_breakdown so backfilled rows have the same shape
 * as runtime-generated rows.
 */

export interface ScoreAdjustment {
  reason: string
  delta: number
  source: string
  evidence_id: string | null
}

export interface ScoreBreakdown {
  base_score: number
  adjustments: ScoreAdjustment[]
  final_score: number | null
  methodology?: 'weighted_with_caps' | 'placeholder_pre_sql_override'
}

const CATEGORY_KEYS: Array<{ cat: string; scoreKey: string; weightKey: string }> = [
  { cat: 'license',  scoreKey: 'license_score',  weightKey: 'license' },
  { cat: 'business', scoreKey: 'business_score', weightKey: 'business' },
  { cat: 'legal',    scoreKey: 'legal_score',    weightKey: 'legal' },
  { cat: 'osha',     scoreKey: 'osha_score',     weightKey: 'osha' },
  { cat: 'bbb',      scoreKey: 'bbb_score',      weightKey: 'bbb' },
  { cat: 'phoenix',  scoreKey: 'phoenix_score',  weightKey: 'phoenix' },
  { cat: 'age',      scoreKey: 'age_score',      weightKey: 'age' },
  { cat: 'permits',  scoreKey: 'permit_score',   weightKey: 'permits' },
]

export function projectInputsSnapshotToBreakdown(
  inputs: Record<string, unknown>,
  composite: number,
  weights: Record<string, unknown>,
): ScoreBreakdown {
  const adjustments: ScoreAdjustment[] = []

  for (const { cat, scoreKey, weightKey } of CATEGORY_KEYS) {
    const score = inputs[scoreKey]
    const weight = weights[weightKey]
    const scoreNum = typeof score === 'number' ? score : Number(score)
    const weightNum = typeof weight === 'number' ? weight : Number(weight)
    if (!Number.isFinite(scoreNum) || !Number.isFinite(weightNum) || weightNum <= 0) continue
    adjustments.push({
      reason: `${cat} sub-score ${scoreNum}/100 × weight ${weightNum}`,
      delta: Math.round(scoreNum * weightNum),
      source: cat,
      evidence_id: null,
    })
  }

  const dampener = inputs['dampener_applied']
  const dampenerNum = typeof dampener === 'number' ? dampener : Number(dampener)
  if (Number.isFinite(dampenerNum) && dampenerNum < 1.0) {
    adjustments.push({
      reason: `Weakest-category dampener (×${dampenerNum})`,
      delta: 0,
      source: 'dampener',
      evidence_id: null,
    })
  }

  const caps = inputs['hard_caps_applied']
  if (Array.isArray(caps)) {
    for (const cap of caps) {
      if (cap && typeof cap === 'object' && 'cap' in cap) {
        adjustments.push({
          reason: `Hard cap: ${String((cap as { cap: unknown }).cap)}`,
          delta: 0,
          source: 'cap',
          evidence_id: null,
        })
      }
    }
  }

  return {
    base_score: 0,
    final_score: Math.round(composite),
    methodology: 'weighted_with_caps',
    adjustments,
  }
}
